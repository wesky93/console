<template>
    <div class="container" :style="{height: height + 'px'}">
        <div class="sidebar-container" :style="sbContainerStyle"
             :class="{transition:transition}"
        >
            <div :style="sbStyle">
                <slot name="sidebar" :width="width" />
            </div>
        </div>
        <div class="resizer-container line"
             @mousedown="startResizing"
             @mousemove="isResizing"
             @mouseup="endResizing"
        >
            <span class="resizer">
                <span @click="hideSidebar">
                    <slot name="hide-button">
                        <p-i class="btn-vertical-hide"
                             width="1rem"
                             height="1rem"
                             :name="hide ? 'btn_ic_tree_hidden—folded' : 'btn_ic_tree_hidden'"
                             :color="hide ? undefined : 'white primary3'"
                        />
                    </slot>
                </span>
            </span>
        </div>
        <div class="main">
            <slot />
        </div>
    </div>
</template>

<script>
import {
    toRefs, reactive, ref, computed,
} from '@vue/composition-api';
import PI from '@/components/atoms/icons/PI.vue';
import { documentEventMount } from '@/lib/compostion-util';

export default {
    name: 'VerticalLayout2',
    components: {
        PI,
    },
    props: {
        height: {
            type: Number,
            default: 620,
        },
        initWidth: {
            type: Number,
            default: 300,
        },
        minWidth: {
            type: Number,
            default: 100,
        },
        maxWidth: {
            type: Number,
            default: 500,
        },
    },
    setup(props, context) {
        const state = reactive({
            width: props.initWidth,
            resizing: false,
            clientX: null,
            hide: false,
            transition: false,
            sbContainerStyle: computed(() => ({
                width: `${state.width}px`,
                overflow: 'auto',
            })),
            sbStyle: computed(() => ({
                width: 'auto',
                height: '100%',
                minWidth: `${props.minWidth}px`,
                maxWidth: `${props.maxWidth}px`,
                opacity: state.hide && !state.transition ? 0 : 1,
            })),
        });

        /* Resizing */
        const isResizing = (event) => {
            if (state.resizing) {
                if (state.clientX === null) {
                    state.clientX = event.clientX;
                    return;
                }
                const delta = state.clientX - event.clientX;
                const width = state.width - delta;
                if (!(width <= props.minWidth || width > props.maxWidth)) {
                    state.width = width;
                }
                state.clientX = event.clientX;
            }
            event.preventDefault();
        };
        const endResizing = () => {
            state.resizing = false;
            state.clientX = null;
        };
        const startResizing = () => {
            state.resizing = true;
        };

        /* Toggle hide Sidebar */
        const offTransition = () => { state.transition = false; };
        const hideSidebar = () => {
            if (!state.hide) {
                state.hide = true;
                state.transition = true;
                state.width = 16;
                setTimeout(offTransition, 500);
            } else {
                state.width = props.initWidth;
                state.transition = true;
                state.hide = false;
                setTimeout(offTransition, 500);
            }
        };
        documentEventMount('mousemove', isResizing);
        documentEventMount('mouseup', endResizing);
        return {
            ...toRefs(state),
            hideSidebar,
            startResizing,
            isResizing,
            endResizing,
        };
    },
};
</script>

<style lang="scss" scoped>
    .container {
        display: flex;
        height: 100%;
        width: 100%;
        flex-direction: row;
        z-index: 1;
        padding: 0;
        margin: unset;
    }
    .sidebar-container {
        &.transition {
            transition: width 0.5s;
        }
    }
    .main {
        flex-grow: 1;
        width: 100%;
    }
    .resizer-container {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        width: 1rem;
        &.line {
            border-left: 1px solid $gray2;
            background-color: transparent;
            &:hover {
                border-left: 1px solid $secondary;
                cursor: ew-resize;
            }
        }
        &.prohibit-line {
            border-left: 1px solid $gray2;
            background-color: transparent;
            &:hover {
                border-left: 1px solid $secondary;
            }
        }
        .resizer {
            display: inline-block;
            font-size: 1.5rem;
            font-weight: 600;
            text-align: center;
            z-index: 99;
            cursor: col-resize;
            color: $gray1;
            > span {
                margin-right: 26px;
                cursor: pointer;
            }
        }
        .btn-vertical-hide{
            margin-top: 1rem;
            margin-left: .5rem;
            justify-content: center;
            &:hover {
                color: $secondary;
            }
        }
    }
</style>