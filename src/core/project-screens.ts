import type { Project, ProjectScreen } from '/src/types';

export const PROJECT_SCREENS_STORAGE_KEY = 'lopaka_project_screens';
export const CURRENT_SCREEN_STORAGE_KEY = 'lopaka_current_screen_id';

export function getScreenTitle(screen: ProjectScreen, index: number): string {
    return screen.title || `Screen ${index + 1}`;
}

export function createProjectScreen(index: number, layers: any[] = [], imagePreview?: string): ProjectScreen {
    return {
        id: index,
        title: `Screen ${index + 1}`,
        layers,
        img_preview: imagePreview,
        order: index,
    };
}

export function normalizeProjectScreens(screens?: ProjectScreen[], fallbackLayers: any[] = []): ProjectScreen[] {
    if (!screens?.length) {
        return [createProjectScreen(0, fallbackLayers)];
    }

    return screens
        .slice()
        .sort((a, b) => (a.order ?? a.id ?? 0) - (b.order ?? b.id ?? 0))
        .map((screen, index) => ({
            ...screen,
            id: Number.isFinite(Number(screen.id)) ? Number(screen.id) : index,
            title: screen.title || `Screen ${index + 1}`,
            layers: screen.layers ?? [],
            order: screen.order ?? index,
        }));
}

export function getNextScreenId(screens: ProjectScreen[]): number {
    return screens.reduce((max, screen) => Math.max(max, Number(screen.id) || 0), -1) + 1;
}

export function captureScreenSnapshot(
    project: Project,
    screenId: number,
    layers: any[],
    imagePreview?: string
): ProjectScreen[] {
    const screens = normalizeProjectScreens(project.screens);
    const nextScreens = screens.map((screen) => {
        if (screen.id !== screenId) {
            return screen;
        }

        return {
            ...screen,
            layers,
            img_preview: imagePreview ?? screen.img_preview,
        };
    });

    project.screens = nextScreens;
    return nextScreens;
}

export function persistProjectScreens(project: Project, currentScreenId?: number): void {
    if (!project.screens?.length) {
        return;
    }

    localStorage.setItem(PROJECT_SCREENS_STORAGE_KEY, JSON.stringify(project.screens));
    if (currentScreenId !== undefined) {
        localStorage.setItem(CURRENT_SCREEN_STORAGE_KEY, `${currentScreenId}`);
    }
}

export function loadStoredProjectScreens(): ProjectScreen[] | null {
    const stored = localStorage.getItem(PROJECT_SCREENS_STORAGE_KEY);
    if (!stored) {
        return null;
    }

    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? normalizeProjectScreens(parsed) : null;
    } catch {
        return null;
    }
}

export function getStoredCurrentScreenId(): number | null {
    const stored = localStorage.getItem(CURRENT_SCREEN_STORAGE_KEY);
    if (stored === null) {
        return null;
    }

    const screenId = Number(stored);
    return Number.isFinite(screenId) ? screenId : null;
}
