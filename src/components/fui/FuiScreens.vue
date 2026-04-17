<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from '/src/components/layout/Icon.vue';
import type { ProjectScreen } from '/src/types';
import { getScreenTitle } from '/src/core/project-screens';

const props = defineProps<{
    screens: ProjectScreen[];
    currentScreen?: ProjectScreen;
    readonly?: boolean;
}>();

const emit = defineEmits(['selectScreen', 'addScreen', 'renameScreen']);

const editingScreenId = ref<number | null>(null);
const renameValue = ref('');
const renameInput = ref<HTMLInputElement | null>(null);

const orderedScreens = computed(() =>
    props.screens
        .slice()
        .sort((a, b) => (a.order ?? a.id ?? 0) - (b.order ?? b.id ?? 0))
        .map((screen, index) => ({
            screen,
            title: getScreenTitle(screen, index),
        }))
);

function isSelected(screen: ProjectScreen): boolean {
    return props.currentScreen?.id === screen.id;
}

function startRename(screen: ProjectScreen, title: string) {
    if (props.readonly) {
        return;
    }
    editingScreenId.value = screen.id;
    renameValue.value = title;
    requestAnimationFrame(() => {
        renameInput.value?.focus();
        renameInput.value?.select();
    });
}

function saveRename(screen: ProjectScreen) {
    if (editingScreenId.value !== screen.id) {
        return;
    }
    const nextTitle = renameValue.value.trim();
    editingScreenId.value = null;
    if (nextTitle && nextTitle !== screen.title) {
        emit('renameScreen', screen, nextTitle);
    }
}

function cancelRename() {
    editingScreenId.value = null;
}

function setRenameInput(el: Element | null) {
    renameInput.value = el as HTMLInputElement | null;
}
</script>

<template>
    <section class="fui-screens font-sans border-b border-secondary pb-3">
        <div class="flex flex-row items-center justify-between px-3 pt-3 pb-2">
            <h2 class="text-lg text-gray-500">Screens</h2>
            <button
                v-if="!readonly"
                class="btn btn-ghost btn-xs btn-square text-gray-500"
                title="Add screen"
                @click="emit('addScreen')"
            >
                <Icon
                    type="plus"
                    sm
                />
            </button>
        </div>
        <ul class="flex flex-col gap-2 px-2">
            <li
                v-for="{ screen, title } in orderedScreens"
                :key="screen.id"
                class="fui-screen-item group flex flex-row items-center gap-2 rounded px-1 py-1 cursor-pointer"
                :class="{ 'bg-base-300': isSelected(screen) }"
                @click="emit('selectScreen', screen)"
            >
                <button
                    v-if="!readonly"
                    class="rename-button btn btn-ghost btn-xs btn-square text-gray-500 shrink-0"
                    title="Rename screen"
                    @click.stop="startRename(screen, title)"
                >
                    <Icon
                        type="edit"
                        xs
                    />
                </button>
                <div
                    class="screen-preview shrink-0"
                    :class="{ 'screen-preview-selected': isSelected(screen) }"
                >
                    <img
                        v-if="screen.img_preview"
                        :src="screen.img_preview"
                        :alt="title"
                    />
                </div>
                <input
                    v-if="editingScreenId === screen.id"
                    :ref="setRenameInput"
                    v-model="renameValue"
                    class="input input-xs input-ghost min-w-0 flex-1 font-bold"
                    @blur="saveRename(screen)"
                    @keydown.enter.prevent="saveRename(screen)"
                    @keydown.esc.prevent="cancelRename"
                    @click.stop
                />
                <button
                    v-else
                    class="truncate min-w-0 text-left font-bold flex-1"
                    @dblclick.stop="startRename(screen, title)"
                >
                    {{ title }}
                </button>
            </li>
        </ul>
    </section>
</template>

<style scoped>
.rename-button {
    visibility: hidden;
}

.fui-screen-item:hover .rename-button {
    visibility: visible;
}

.screen-preview {
    width: 32px;
    height: 32px;
    border: 2px solid transparent;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.screen-preview-selected {
    border-color: #ff8200;
}

.screen-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
}
</style>
