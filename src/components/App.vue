<script
    lang="ts"
    setup
>
import { onMounted, ref } from 'vue';
import { useSession } from '/src/core/session';
import FuiEditor from '/src/components/fui/FuiEditor.vue';
import { Project, ProjectScreen } from '/src/types';
import FuiLayers from './fui/layers/FuiLayers.vue';
import FuiScreens from './fui/FuiScreens.vue';
import {
    captureScreenSnapshot,
    createProjectScreen,
    getNextScreenId,
    getStoredCurrentScreenId,
    loadStoredProjectScreens,
    normalizeProjectScreens,
    persistProjectScreens,
} from '/src/core/project-screens';
import type { LopakaProjectFile } from '/src/core/project-file';

const session = useSession();
const { setIsPublic } = session;
const currenProject = ref({} as Project);
const currentScreen = ref({} as ProjectScreen);
const isScreenLoaded = ref(false);
const isScreenNotFound = ref(false);
const infoMessage = ref();
const errorMessage = ref();

const emit = defineEmits(['showModal']);

onMounted(async () => {
    session.state.customImages = [];
    session.state.customFonts = [];
    isScreenLoaded.value = false;
    await session.initSandbox();

    const fallbackLayers = session.layersManager.layers.map((layer) => layer.state);
    const storedScreens = loadStoredProjectScreens();
    const screens = normalizeProjectScreens(storedScreens ?? undefined, fallbackLayers);
    const storedScreenId = getStoredCurrentScreenId();
    const selectedScreen = screens.find((screen) => screen.id === storedScreenId) ?? screens[0];

    currenProject.value = {
        id: 0,
        title: '',
        screens,
        platform: session.state.platform,
        screen_x: session.state.display.x,
        screen_y: session.state.display.y,
        private: true,
    };
    currentScreen.value = selectedScreen;
    if (storedScreens) {
        await loadScreenLayers(selectedScreen);
    }
    persistProjectScreens(currenProject.value, selectedScreen.id);
    isScreenLoaded.value = true;
    setIsPublic(false);
});

function getCurrentLayerSnapshot() {
    return session.layersManager.layers.map((layer) => layer.state);
}

function getCurrentPreview() {
    return session.virtualScreen.canvas?.toDataURL?.();
}

function saveCurrentScreenSnapshot() {
    if (currentScreen.value?.id === undefined || !currenProject.value?.screens?.length) {
        return;
    }

    captureScreenSnapshot(
        currenProject.value,
        currentScreen.value.id,
        getCurrentLayerSnapshot(),
        getCurrentPreview()
    );
    persistProjectScreens(currenProject.value, currentScreen.value.id);
}

async function loadScreenLayers(screen: ProjectScreen) {
    session.editor.clear();
    session.history.clear(false);
    await session.layersManager.loadLayers(screen.layers ?? []);
    session.layersManager.clearSelection();
    session.virtualScreen.redraw();
}

async function selectScreen(screen: ProjectScreen) {
    if (screen.id === currentScreen.value?.id) {
        return;
    }

    isScreenLoaded.value = false;
    saveCurrentScreenSnapshot();
    currentScreen.value = screen;
    await loadScreenLayers(screen);
    persistProjectScreens(currenProject.value, screen.id);
    isScreenLoaded.value = true;
}

async function addScreen() {
    isScreenLoaded.value = false;
    saveCurrentScreenSnapshot();
    const screens = normalizeProjectScreens(currenProject.value.screens);
    const nextId = getNextScreenId(screens);
    const nextScreen = createProjectScreen(screens.length);
    nextScreen.id = nextId;
    screens.push(nextScreen);
    currenProject.value.screens = screens;
    currentScreen.value = nextScreen;
    await loadScreenLayers(nextScreen);
    persistProjectScreens(currenProject.value, nextId);
    isScreenLoaded.value = true;
}

function renameScreen(screen: ProjectScreen, title: string) {
    const screens = normalizeProjectScreens(currenProject.value.screens).map((item) =>
        item.id === screen.id ? { ...item, title } : item
    );
    currenProject.value.screens = screens;
    if (currentScreen.value?.id === screen.id) {
        currentScreen.value = screens.find((item) => item.id === screen.id) ?? currentScreen.value;
    }
    persistProjectScreens(currenProject.value, currentScreen.value?.id);
}

function onProjectLoaded(snapshot: LopakaProjectFile) {
    const screens = normalizeProjectScreens(
        snapshot.screens.map((screen, index) => ({
            id: screen.id,
            title: screen.title || `Screen ${index + 1}`,
            img_preview: screen.imagePreview,
            layers: screen.layers,
            order: index,
        }))
    );
    currenProject.value = {
        ...currenProject.value,
        title: snapshot.project.title,
        platform: snapshot.project.platform,
        screen_x: snapshot.project.display[0],
        screen_y: snapshot.project.display[1],
        screens,
    };
    currentScreen.value = screens[0];
    persistProjectScreens(currenProject.value, currentScreen.value.id);
}

function setInfoMessage(msg) {
    infoMessage.value = msg;
    setTimeout(() => {
        infoMessage.value = null;
    }, 3000);
}
function setErrorMessage(msg) {
    errorMessage.value = msg;
    setTimeout(() => {
        errorMessage.value = null;
    }, 4000);
}
</script>

<template>
    <div class="flex flex-col flex-grow">
        <FuiEditor
            :project="currenProject"
            :screen="currentScreen"
            :isScreenLoaded="isScreenLoaded"
            :isScreenNotFound="isScreenNotFound"
            @setErrorMessage="setErrorMessage"
            @setInfoMessage="setInfoMessage"
            @projectLoaded="onProjectLoaded"
        >
            <template #messages>
                <div
                    class="alert alert-warning"
                    v-if="errorMessage"
                >
                    <span>{{ errorMessage }}</span>
                </div>
                <div
                    class="alert alert-success"
                    v-if="infoMessage"
                >
                    <span>{{ infoMessage }}</span>
                </div>
            </template>
            <template #left>
                <FuiScreens
                    :screens="currenProject.screens ?? []"
                    :currentScreen="currentScreen"
                    @selectScreen="selectScreen"
                    @addScreen="addScreen"
                    @renameScreen="renameScreen"
                />
                <FuiLayers></FuiLayers>
            </template>
            <template #title></template>
        </FuiEditor>
    </div>
    <datalist id="presetColors">
        <!-- 32 colors -->
        <!-- Grayscale -->
        <option>#FFFFFF</option>
        <option>#EEEEEE</option>
        <option>#BDBDBD</option>
        <option>#757575</option>
        <option>#424242</option>
        <option>#000000</option>

        <!-- Material UI Colors -->
        <option label="Red">#F44336</option>
        <option label="Pink">#E91E63</option>
        <option label="Purple">#9C27B0</option>
        <option label="Deep Purple">#673AB7</option>
        <option label="Indigo">#3F51B5</option>
        <option label="Blue">#2196F3</option>
        <option label="Light Blue">#03A9F4</option>
        <option label="Cyan">#00BCD4</option>
        <option label="Teal">#009688</option>
        <option label="Green">#4CAF50</option>
        <option label="Light Green">#8BC34A</option>
        <option label="Lime">#CDDC39</option>
        <option label="Yellow">#FFEB3B</option>
        <option label="Amber">#FFC107</option>
        <option label="Orange">#FF8200</option>
        <option label="Deep Orange">#FF5722</option>
        <option label="Brown">#795548</option>
        <option label="Blue Grey">#607D8B</option>
    </datalist>
</template>
<style lang="css">
body {
    visibility: visible !important;
}

.pixelated {
    image-rendering: pixelated;
}
</style>
