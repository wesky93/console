<template>
    <div class="general-page-layout">
        <div class="page-contents">
            <slot />
        </div>
        <div class="fnb">
            <FNB />
        </div>
    </div>
</template>

<script>
import { reactive, toRefs } from '@vue/composition-api';
import FNB from '@/views/containers/fnb/FNB.vue';

export default {
    name: 'GeneralPageLayout',
    components: { FNB },
    setup() {
        return {};
    },
};
</script>

<style lang="postcss" scoped>
.general-page-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: stretch;

    .page-contents {
        width: 100%;
        flex-grow: 1;
        padding: 1.5rem 2rem 2rem 2rem;
    }
    .fnb {
        width: 100%;
    }
}
</style>
