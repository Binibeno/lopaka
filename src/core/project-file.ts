import { Point } from './point';
import type { Session } from './session';
import { downloadAsFile, loadImageAsync } from '../utils';

export const LOPAKA_PROJECT_FORMAT = 'lopaka-project';
export const LOPAKA_PROJECT_VERSION = 1;
export const LOPAKA_PROJECT_EXTENSION = '.lopaka.json';

type JsonObject = Record<string, any>;

export type LopakaProjectScreenFile = {
    id: number;
    title?: string;
    imagePreview?: string;
    layers: JsonObject[];
};

export type LopakaProjectFile = {
    format: typeof LOPAKA_PROJECT_FORMAT;
    version: typeof LOPAKA_PROJECT_VERSION;
    createdAt: string;
    app: {
        name: 'lopaka';
        schemaVersion: typeof LOPAKA_PROJECT_VERSION;
    };
    project: {
        title: string;
        screenTitle: string;
        platform: string;
        display: [number, number];
        isDisplayCustom: boolean;
        scale: number;
        paintColorMode: 'rgb' | 'monochrome';
        brushColor: string;
    };
    platformSettings: {
        screenBgColor?: string;
        codeTemplate?: string;
        codeSettings?: Record<string, boolean>;
    };
    assets: {
        customFonts: TPlatformFont[];
        customImages: SerializedCustomImage[];
    };
    screens: LopakaProjectScreenFile[];
};

type SerializedCustomImage = {
    name: string;
    width: number;
    height: number;
    colorMode?: string;
    isCustom?: boolean;
    id?: number;
    src?: string;
};

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDisplay(value: unknown): [number, number] {
    if (!Array.isArray(value) || value.length < 2) {
        throw new Error('Project file is missing a valid display size.');
    }
    const width = Number(value[0]);
    const height = Number(value[1]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
        throw new Error('Project file has an invalid display size.');
    }
    return [Math.round(width), Math.round(height)];
}

function normalizeScale(value: unknown): number {
    const scale = Number(value);
    return Number.isFinite(scale) && scale > 0 ? scale : 400;
}

function normalizePaintColorMode(value: unknown): 'rgb' | 'monochrome' {
    return value === 'rgb' ? 'rgb' : 'monochrome';
}

function serializeCustomImage(asset: any): SerializedCustomImage {
    return {
        name: asset.name,
        width: Number(asset.width) || 0,
        height: Number(asset.height) || 0,
        colorMode: asset.colorMode,
        isCustom: asset.isCustom,
        id: typeof asset.id === 'number' ? asset.id : undefined,
        src: asset.image?.src,
    };
}

function normalizeCustomFonts(fonts: unknown): TPlatformFont[] {
    if (!Array.isArray(fonts)) {
        return [];
    }

    return fonts
        .filter((font): font is JsonObject => isObject(font))
        .filter((font) => typeof font.name === 'string' && typeof font.title === 'string')
        .filter((font) => typeof font.file === 'string' || typeof font.file === 'number')
        .filter((font) => typeof font.format === 'number')
        .map((font) => {
            const options =
                isObject(font.options) && typeof font.options.size === 'number'
                    ? {
                          size: font.options.size,
                          textCharHeight:
                              typeof font.options.textCharHeight === 'number'
                                  ? font.options.textCharHeight
                                  : undefined,
                          textCharWidth:
                              typeof font.options.textCharWidth === 'number'
                                  ? font.options.textCharWidth
                                  : undefined,
                      }
                    : undefined;

            return {
                name: font.name,
                title: font.title,
                file: font.file,
                options,
                format: font.format,
            };
        });
}

async function hydrateCustomImages(images: SerializedCustomImage[] = []): Promise<TLayerImageData[]> {
    const hydrated = await Promise.all(
        images.map(async (asset): Promise<TLayerImageData | null> => {
            if (!asset.src) {
                return null;
            }
            try {
                const image = await loadImageAsync(asset.src);
                const hydratedAsset: TLayerImageData = {
                    name: asset.name,
                    width: asset.width,
                    height: asset.height,
                    colorMode: asset.colorMode,
                    isCustom: asset.isCustom ?? true,
                    image,
                };
                if (typeof asset.id === 'number') {
                    hydratedAsset.id = asset.id;
                }
                return hydratedAsset;
            } catch {
                return null;
            }
        })
    );
    return hydrated.filter((asset): asset is TLayerImageData => Boolean(asset));
}

export function createProjectSnapshot(session: Session, createdAt = new Date()): LopakaProjectFile {
    const platform = session.state.platform;
    const platformInstance = session.platforms[platform];
    const display = session.state.display;
    const title = session.state.screenTitle ?? '';
    const layers = session.layersManager.layers.map((layer) => layer.state);

    return {
        format: LOPAKA_PROJECT_FORMAT,
        version: LOPAKA_PROJECT_VERSION,
        createdAt: createdAt.toISOString(),
        app: {
            name: 'lopaka',
            schemaVersion: LOPAKA_PROJECT_VERSION,
        },
        project: {
            title,
            screenTitle: title,
            platform,
            display: [display.x, display.y],
            isDisplayCustom: Boolean(session.state.isDisplayCustom),
            scale: Math.round(session.state.scale.x * 100),
            paintColorMode: normalizePaintColorMode(session.state.paintColorMode),
            brushColor: session.state.brushColor,
        },
        platformSettings: {
            screenBgColor: platformInstance?.features?.screenBgColor,
            codeTemplate: platformInstance?.getTemplate(),
            codeSettings: cloneJson(platformInstance?.getTemplateSettings() ?? {}),
        },
        assets: {
            customFonts: cloneJson(session.state.customFonts ?? []),
            customImages: (session.state.customImages ?? []).map(serializeCustomImage),
        },
        screens: [
            {
                id: 0,
                title,
                imagePreview: session.virtualScreen.canvas?.toDataURL?.(),
                layers,
            },
        ],
    };
}

export function parseProjectFile(content: string): LopakaProjectFile {
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('Project file is not valid JSON.');
    }
    return validateProjectFile(parsed);
}

export function validateProjectFile(value: unknown): LopakaProjectFile {
    if (!isObject(value) || value.format !== LOPAKA_PROJECT_FORMAT) {
        throw new Error('This is not a Lopaka project file.');
    }

    const version = Number(value.version);
    if (!Number.isFinite(version) || version < 1) {
        throw new Error('Project file is missing a valid version.');
    }
    if (version > LOPAKA_PROJECT_VERSION) {
        throw new Error(`Project file version ${version} is not supported by this version of Lopaka.`);
    }

    if (!isObject(value.project)) {
        throw new Error('Project file is missing project details.');
    }
    if (typeof value.project.platform !== 'string' || !value.project.platform) {
        throw new Error('Project file is missing a platform.');
    }

    if (!Array.isArray(value.screens) || value.screens.length === 0) {
        throw new Error('Project file does not contain any screens.');
    }

    const screens = value.screens.map((screen: any, index: number) => {
        if (!isObject(screen) || !Array.isArray(screen.layers)) {
            throw new Error('Project file contains an invalid screen.');
        }
        return {
            id: Number.isFinite(Number(screen.id)) ? Number(screen.id) : index,
            title: typeof screen.title === 'string' ? screen.title : '',
            imagePreview: typeof screen.imagePreview === 'string' ? screen.imagePreview : undefined,
            layers: screen.layers,
        };
    });

    const assets = isObject(value.assets) ? value.assets : {};
    const platformSettings = isObject(value.platformSettings) ? value.platformSettings : {};

    return {
        format: LOPAKA_PROJECT_FORMAT,
        version: LOPAKA_PROJECT_VERSION,
        createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
        app: {
            name: 'lopaka',
            schemaVersion: LOPAKA_PROJECT_VERSION,
        },
        project: {
            title: typeof value.project.title === 'string' ? value.project.title : '',
            screenTitle: typeof value.project.screenTitle === 'string' ? value.project.screenTitle : '',
            platform: value.project.platform,
            display: normalizeDisplay(value.project.display),
            isDisplayCustom: Boolean(value.project.isDisplayCustom),
            scale: normalizeScale(value.project.scale),
            paintColorMode: normalizePaintColorMode(value.project.paintColorMode),
            brushColor: typeof value.project.brushColor === 'string' ? value.project.brushColor : '#ffffff',
        },
        platformSettings: {
            screenBgColor:
                typeof platformSettings.screenBgColor === 'string' ? platformSettings.screenBgColor : undefined,
            codeTemplate: typeof platformSettings.codeTemplate === 'string' ? platformSettings.codeTemplate : undefined,
            codeSettings: isObject(platformSettings.codeSettings)
                ? cloneJson(platformSettings.codeSettings)
                : undefined,
        },
        assets: {
            customFonts: normalizeCustomFonts(assets.customFonts),
            customImages: Array.isArray(assets.customImages) ? cloneJson(assets.customImages) : [],
        },
        screens,
    };
}

function applyPlatformSettings(session: Session, snapshot: LopakaProjectFile): void {
    const platform = snapshot.project.platform;
    const platformInstance = session.platforms[platform];
    if (!platformInstance) {
        throw new Error(`Project platform "${platform}" is not supported.`);
    }

    if (snapshot.platformSettings.screenBgColor) {
        platformInstance.features.screenBgColor = snapshot.platformSettings.screenBgColor;
    }

    const templates = platformInstance.getTemplates();
    const codeTemplate = snapshot.platformSettings.codeTemplate;
    if (codeTemplate && templates[codeTemplate]) {
        platformInstance.setTemplate(codeTemplate);
    }

    const codeSettings = snapshot.platformSettings.codeSettings ?? {};
    Object.entries(codeSettings).forEach(([name, value]) => {
        if (Object.prototype.hasOwnProperty.call(platformInstance.getTemplateSettings(), name)) {
            platformInstance.setTemplateSetting(name, Boolean(value));
        }
    });
}

function persistProjectSnapshotToLocalStorage(session: Session, snapshot: LopakaProjectFile): void {
    const platform = snapshot.project.platform;
    const platformInstance = session.platforms[platform];
    const [width, height] = snapshot.project.display;

    localStorage.setItem('lopaka_library', platform);
    localStorage.setItem('lopaka_display', `${width}×${height}`);
    localStorage.setItem('lopaka_display_custom', snapshot.project.isDisplayCustom ? 'true' : 'false');
    localStorage.setItem('lopaka_scale', `${snapshot.project.scale}`);
    localStorage.setItem(`${platform}_lopaka_layers`, JSON.stringify(snapshot.screens[0]?.layers ?? []));

    if (platformInstance?.features?.screenBgColor) {
        localStorage.setItem(`lopaka_${platform}_color_bg`, platformInstance.features.screenBgColor);
    }
    if (platformInstance?.getTemplate()) {
        localStorage.setItem(`lopaka_${platform}_code_template`, platformInstance.getTemplate());
    }
    if (platformInstance?.getTemplateSettings()) {
        localStorage.setItem(`lopaka_${platform}_code_settings`, JSON.stringify(platformInstance.getTemplateSettings()));
    }
}

export async function restoreProjectSnapshot(session: Session, snapshot: LopakaProjectFile): Promise<void> {
    const platform = snapshot.project.platform;
    const screen = snapshot.screens[0];

    if (!session.platforms[platform]) {
        throw new Error(`Project platform "${platform}" is not supported.`);
    }

    applyPlatformSettings(session, snapshot);
    session.state.customFonts = cloneJson(snapshot.assets.customFonts ?? []);
    session.state.customImages = await hydrateCustomImages(snapshot.assets.customImages ?? []);
    session.setDisplay(new Point(snapshot.project.display[0], snapshot.project.display[1]));
    session.setDisplayCustom(snapshot.project.isDisplayCustom);
    session.setScale(snapshot.project.scale);

    await session.preparePlatform(platform, false, screen.layers);

    session.setScreenTitle(snapshot.project.screenTitle || screen.title || snapshot.project.title || '');
    session.setPaintColorMode(snapshot.project.paintColorMode);
    session.setBrushColor(snapshot.project.brushColor);
    persistProjectSnapshotToLocalStorage(session, snapshot);
    session.virtualScreen.resize();
    session.virtualScreen.redraw();
    session.state.immidiateUpdates++;
}

export function getProjectFileName(snapshot: LopakaProjectFile): string {
    const label = snapshot.project.screenTitle || snapshot.project.title || snapshot.project.platform || 'lopaka-project';
    const safeLabel = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    return `${safeLabel || 'lopaka-project'}${LOPAKA_PROJECT_EXTENSION}`;
}

export function downloadProjectSnapshot(snapshot: LopakaProjectFile): void {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    downloadAsFile(getProjectFileName(snapshot), blob, 'blob');
}
