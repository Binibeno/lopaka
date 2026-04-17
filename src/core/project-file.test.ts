import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Point } from './point';
import type { Session } from './session';
import {
    createProjectSnapshot,
    LOPAKA_PROJECT_FORMAT,
    LOPAKA_PROJECT_VERSION,
    parseProjectFile,
    restoreProjectSnapshot,
    validateProjectFile,
} from './project-file';

function createFakePlatform() {
    const settingsByTemplate = {
        Default: {
            wrap: false,
            include_images: true,
        },
        Compact: {
            wrap: false,
            include_images: false,
        },
    };
    let template = 'Default';

    return {
        features: {
            screenBgColor: '#000000',
            defaultColor: '#ffffff',
        },
        getTemplates: vi.fn(() => ({
            Default: { settings: settingsByTemplate.Default },
            Compact: { settings: settingsByTemplate.Compact },
        })),
        getTemplate: vi.fn(() => template),
        setTemplate: vi.fn((nextTemplate: string) => {
            template = nextTemplate;
        }),
        getTemplateSettings: vi.fn(() => settingsByTemplate[template]),
        setTemplateSetting: vi.fn((name: string, value: boolean) => {
            settingsByTemplate[template][name] = value;
        }),
    };
}

function createFakeSession() {
    const platform = createFakePlatform();
    const state = {
        platform: 'tft-espi',
        display: new Point(128, 64),
        isDisplayCustom: false,
        scale: new Point(4, 4),
        screenTitle: 'Status Screen',
        brushColor: '#ff0000',
        paintColorMode: 'rgb',
        customFonts: [{ name: 'CustomFont', title: 'Custom Font', file: '/fonts/custom.h' }],
        customImages: [],
        immidiateUpdates: 1,
    };
    const session = {
        state,
        platforms: {
            'tft-espi': platform,
        },
        layersManager: {
            layers: [
                {
                    state: {
                        t: 'rect',
                        n: 'Layer 1',
                    },
                },
            ],
        },
        virtualScreen: {
            canvas: {
                toDataURL: vi.fn(() => 'data:image/png;base64,preview'),
            },
            resize: vi.fn(),
            redraw: vi.fn(),
        },
        setDisplay: vi.fn((display: Point) => {
            state.display = display;
        }),
        setDisplayCustom: vi.fn((enabled: boolean) => {
            state.isDisplayCustom = enabled;
        }),
        setScale: vi.fn((scale: number) => {
            state.scale = new Point(scale / 100, scale / 100);
        }),
        setScreenTitle: vi.fn((title: string) => {
            state.screenTitle = title;
        }),
        setPaintColorMode: vi.fn((mode: 'rgb' | 'monochrome') => {
            state.paintColorMode = mode;
        }),
        setBrushColor: vi.fn((color: string) => {
            state.brushColor = color;
        }),
        preparePlatform: vi.fn(async (platformName: string, _isLogged: boolean, layers: any[]) => {
            state.platform = platformName;
            session.layersManager.layers = layers.map((layer) => ({ state: layer }));
        }),
    };

    return { session: session as unknown as Session, platform };
}

describe('project file sharing', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('exports a versioned project snapshot with platform, display, settings, and screen layers', () => {
        const { session } = createFakeSession();
        const snapshot = createProjectSnapshot(session, new Date('2026-04-17T12:00:00.000Z'));

        expect(snapshot.format).toBe(LOPAKA_PROJECT_FORMAT);
        expect(snapshot.version).toBe(LOPAKA_PROJECT_VERSION);
        expect(snapshot.createdAt).toBe('2026-04-17T12:00:00.000Z');
        expect(snapshot.project.platform).toBe('tft-espi');
        expect(snapshot.project.display).toEqual([128, 64]);
        expect(snapshot.project.scale).toBe(400);
        expect(snapshot.platformSettings).toMatchObject({
            screenBgColor: '#000000',
            codeTemplate: 'Default',
            codeSettings: {
                wrap: false,
                include_images: true,
            },
        });
        expect(snapshot.assets.customFonts).toEqual([
            { name: 'CustomFont', title: 'Custom Font', file: '/fonts/custom.h' },
        ]);
        expect(snapshot.screens).toEqual([
            {
                id: 0,
                title: 'Status Screen',
                imagePreview: 'data:image/png;base64,preview',
                layers: [{ t: 'rect', n: 'Layer 1' }],
            },
        ]);
    });

    it('rejects invalid and unsupported project files before they can be restored', () => {
        expect(() => parseProjectFile('not json')).toThrow('Project file is not valid JSON.');
        expect(() => validateProjectFile({ format: 'other', version: 1 })).toThrow('This is not a Lopaka project file.');
        expect(() =>
            validateProjectFile({
                format: LOPAKA_PROJECT_FORMAT,
                version: LOPAKA_PROJECT_VERSION + 1,
                project: { platform: 'tft-espi', display: [128, 64] },
                screens: [{ id: 0, layers: [] }],
            })
        ).toThrow('is not supported');
    });

    it('restores a project snapshot and mirrors it to the existing localStorage keys', async () => {
        const { session, platform } = createFakeSession();
        const snapshot = validateProjectFile({
            format: LOPAKA_PROJECT_FORMAT,
            version: LOPAKA_PROJECT_VERSION,
            createdAt: '2026-04-17T12:00:00.000Z',
            project: {
                title: 'Imported',
                screenTitle: 'Imported Screen',
                platform: 'tft-espi',
                display: [240, 135],
                isDisplayCustom: true,
                scale: 200,
                paintColorMode: 'monochrome',
                brushColor: '#00ff00',
            },
            platformSettings: {
                screenBgColor: '#101010',
                codeTemplate: 'Compact',
                codeSettings: {
                    wrap: true,
                    include_images: true,
                },
            },
            assets: {
                customFonts: [{ name: 'ImportedFont', title: 'Imported Font', file: '/fonts/imported.h' }],
                customImages: [],
            },
            screens: [
                {
                    id: 0,
                    title: 'Imported Screen',
                    layers: [{ t: 'line', n: 'Imported Layer' }],
                },
            ],
        });

        await restoreProjectSnapshot(session, snapshot);

        expect(session.setDisplay).toHaveBeenCalledWith(expect.objectContaining({ x: 240, y: 135 }));
        expect(session.setDisplayCustom).toHaveBeenCalledWith(true);
        expect(session.setScale).toHaveBeenCalledWith(200);
        expect(session.preparePlatform).toHaveBeenCalledWith('tft-espi', false, [{ t: 'line', n: 'Imported Layer' }]);
        expect(session.setScreenTitle).toHaveBeenCalledWith('Imported Screen');
        expect(session.setPaintColorMode).toHaveBeenCalledWith('monochrome');
        expect(session.setBrushColor).toHaveBeenCalledWith('#00ff00');
        expect(platform.features.screenBgColor).toBe('#101010');
        expect(platform.setTemplate).toHaveBeenCalledWith('Compact');
        expect(platform.getTemplateSettings()).toEqual({
            wrap: true,
            include_images: true,
        });

        expect(localStorage.getItem('lopaka_library')).toBe('tft-espi');
        expect(localStorage.getItem('lopaka_display')).toBe('240×135');
        expect(localStorage.getItem('lopaka_display_custom')).toBe('true');
        expect(localStorage.getItem('lopaka_scale')).toBe('200');
        expect(localStorage.getItem('lopaka_tft-espi_color_bg')).toBe('#101010');
        expect(localStorage.getItem('lopaka_tft-espi_code_template')).toBe('Compact');
        expect(JSON.parse(localStorage.getItem('tft-espi_lopaka_layers') ?? '[]')).toEqual([
            { t: 'line', n: 'Imported Layer' },
        ]);
    });
});
