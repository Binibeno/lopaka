<script setup lang="ts">
import { nextTick, ref } from 'vue';
import Button from '/src/components/layout/Button.vue';
import Icon from '/src/components/layout/Icon.vue';
import FuiPopup from './FuiPopup.vue';
import { useSession } from '/src/core/session';
import {
    createProjectSnapshot,
    downloadProjectSnapshot,
    parseProjectFile,
    restoreProjectSnapshot,
} from '/src/core/project-file';
import { logEvent, readTextFileAsync } from '/src/utils';

const emit = defineEmits(['setInfoMessage', 'setErrorMessage', 'projectLoaded']);

const session = useSession();
const fileInput = ref<HTMLInputElement | null>(null);
const fileInputKey = ref(0);
const showLoadWarning = ref(false);
const isLoading = ref(false);

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Project file could not be loaded.';
}

function saveProjectFile() {
    try {
        const snapshot = createProjectSnapshot(session);
        downloadProjectSnapshot(snapshot);
        emit('setInfoMessage', 'Project file saved');
        logEvent('button_save_project_file');
    } catch (error) {
        emit('setErrorMessage', getErrorMessage(error));
    }
}

function openLoadWarning() {
    showLoadWarning.value = true;
    logEvent('button_load_project_file');
}

function cancelLoad() {
    if (isLoading.value) {
        return;
    }
    showLoadWarning.value = false;
    fileInputKey.value++;
}

async function chooseFile() {
    await nextTick();
    fileInput.value?.click();
}

async function onProjectFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
        return;
    }

    isLoading.value = true;
    try {
        const fileContent = await readTextFileAsync(file);
        const snapshot = parseProjectFile(fileContent);
        await restoreProjectSnapshot(session, snapshot);
        emit('projectLoaded');
        emit('setInfoMessage', 'Project file loaded');
    } catch (error) {
        emit('setErrorMessage', getErrorMessage(error));
    } finally {
        isLoading.value = false;
        showLoadWarning.value = false;
        fileInputKey.value++;
    }
}
</script>

<template>
    <div class="flex flex-row gap-2 items-center">
        <Button
            secondary
            filled
            title="Save an editable Lopaka project file"
            @click="saveProjectFile"
        >
            <Icon
                type="download"
                pointer
            />
            Save file
        </Button>
        <Button
            secondary
            filled
            title="Load an editable Lopaka project file"
            @click="openLoadWarning"
        >
            <Icon
                type="upload"
                pointer
            />
            Load file
        </Button>
        <input
            ref="fileInput"
            :key="fileInputKey"
            type="file"
            accept=".lopaka.json,application/json"
            class="fixed -top-full"
            @change="onProjectFileChange"
        />
        <FuiPopup v-if="showLoadWarning">
            <div class="font-sans text-sm max-w-md">
                <div class="font-bold text-lg pb-3">Load project file?</div>
                <p class="pb-4">
                    Loading a project file replaces the current editor contents. Save anything you want to keep before
                    continuing.
                </p>
                <div class="flex flex-row justify-end gap-2">
                    <Button
                        :disabled="isLoading"
                        @click="cancelLoad"
                    >
                        Cancel
                    </Button>
                    <Button
                        :success="true"
                        :disabled="isLoading"
                        @click="chooseFile"
                    >
                        <span
                            v-if="isLoading"
                            class="loading loading-sm loading-spinner"
                        ></span>
                        Choose file
                    </Button>
                </div>
            </div>
        </FuiPopup>
    </div>
</template>
