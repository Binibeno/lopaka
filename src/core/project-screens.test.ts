import { beforeEach, describe, expect, it } from 'vitest';
import type { Project } from '/src/types';
import {
    captureScreenSnapshot,
    createProjectScreen,
    getNextScreenId,
    getScreenTitle,
    getStoredCurrentScreenId,
    loadStoredProjectScreens,
    normalizeProjectScreens,
    persistProjectScreens,
} from './project-screens';

describe('project screens', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('creates default screen names and normalizes empty screen lists', () => {
        const screens = normalizeProjectScreens(undefined, [{ t: 'rect', n: 'Layer 1' }]);

        expect(screens).toEqual([
            {
                id: 0,
                title: 'Screen 1',
                layers: [{ t: 'rect', n: 'Layer 1' }],
                order: 0,
                img_preview: undefined,
            },
        ]);
        expect(getScreenTitle(screens[0], 0)).toBe('Screen 1');
    });

    it('creates new screens using the next available id', () => {
        const screens = [createProjectScreen(0), { ...createProjectScreen(1), id: 7 }];

        expect(getNextScreenId(screens)).toBe(8);
        expect(createProjectScreen(screens.length).title).toBe('Screen 3');
    });

    it('captures layers and preview for one screen without changing other screens', () => {
        const project = {
            id: 0,
            title: '',
            platform: 'tft-espi',
            screen_x: 128,
            screen_y: 64,
            screens: [
                { ...createProjectScreen(0), layers: [{ t: 'line' }] },
                { ...createProjectScreen(1), layers: [{ t: 'rect' }] },
            ],
        } as Project;

        captureScreenSnapshot(project, 0, [{ t: 'circle' }], 'data:image/png;base64,preview');

        expect(project.screens?.[0].layers).toEqual([{ t: 'circle' }]);
        expect(project.screens?.[0].img_preview).toBe('data:image/png;base64,preview');
        expect(project.screens?.[1].layers).toEqual([{ t: 'rect' }]);
    });

    it('persists and restores screen list state from localStorage', () => {
        const project = {
            id: 0,
            title: '',
            platform: 'tft-espi',
            screen_x: 128,
            screen_y: 64,
            screens: [createProjectScreen(0), createProjectScreen(1)],
        } as Project;

        persistProjectScreens(project, 1);

        expect(getStoredCurrentScreenId()).toBe(1);
        expect(loadStoredProjectScreens()?.map((screen) => screen.title)).toEqual(['Screen 1', 'Screen 2']);
    });
});
