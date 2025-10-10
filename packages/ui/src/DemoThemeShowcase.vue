<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useTheme } from './index'

const t = useTheme()

const themes = ['slate', 'notion', 'bilibili']
const colorHex = ref('#FB7299')

function setTheme(name: string) {
  t.setTheme(name)
}
function toggleDark() {
  t.toggle()
}
function systemMode() {
  t.enableSystemMode()
}
async function applyPrimary() {
  await t.applyPrimaryHex(colorHex.value)
}
async function copyCurrent() {
  await t.copyThemeJSON(t.theme.value)
}

const cssVarsKeys = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--success',
  '--success-foreground',
  '--warning',
  '--warning-foreground',
  '--info',
  '--info-foreground',
  '--radius',
  '--border-width',
  '--ring-offset',
]
const cssVars = ref<Record<string, string>>({})
function refreshCssVars() {
  const s = getComputedStyle(document.documentElement)
  cssVars.value = Object.fromEntries(cssVarsKeys.map((k) => [k, s.getPropertyValue(k).trim()]))
}

onMounted(() => {
  t.loadPersisted()
  refreshCssVars()
})
watch([t.theme, t.isDark], () => refreshCssVars())
</script>

<template>
  <div class="page">
    <section class="controls card section">
      <div class="row">
        <div>
          <div class="title">主题切换</div>
          <div class="btns">
            <button v-for="name in themes" :key="name" class="btn btn-outline" @click="setTheme(name)">
              {{ name }}
            </button>
          </div>
        </div>
        <div>
          <div class="title">暗色模式</div>
          <div class="btns">
            <button class="btn btn-primary" @click="toggleDark">Toggle Dark</button>
            <button class="btn btn-secondary" @click="systemMode">System Mode</button>
          </div>
        </div>
        <div>
          <div class="title">主色选择（自定义主题）</div>
          <div class="btns">
            <input type="color" v-model="colorHex" />
            <button class="btn btn-accent" @click="applyPrimary">应用主色</button>
            <button class="btn btn-ghost" @click="setTheme('__custom__')">切到自定义</button>
          </div>
        </div>
        <div>
          <div class="title">主题 JSON</div>
          <div class="btns">
            <button class="btn btn-outline" @click="copyCurrent">复制当前主题 JSON</button>
          </div>
        </div>
      </div>
      <div class="hint">
        当前主题：<strong>{{ t.theme }}</strong>；暗色：<strong>{{ t.isDark ? 'ON' : 'OFF' }}</strong>
      </div>
    </section>

    <section class="card section">
      <div class="title">语义类（背景/文本/边框/状态）</div>
      <div class="grid">
        <div class="swatch bg-background text-foreground">bg-background / text-foreground</div>
        <div class="swatch bg-card text-card-foreground">bg-card / text-card-foreground</div>
        <div class="swatch bg-primary text-primary-foreground">bg-primary / text-primary-foreground</div>
        <div class="swatch bg-secondary text-secondary-foreground">bg-secondary / text-secondary-foreground</div>
        <div class="swatch bg-accent text-accent-foreground">bg-accent / text-accent-foreground</div>
        <div class="swatch bg-success text-success-foreground">bg-success / text-success-foreground</div>
        <div class="swatch bg-warning text-warning-foreground">bg-warning / text-warning-foreground</div>
        <div class="swatch bg-info text-info-foreground">bg-info / text-info-foreground</div>
        <div class="swatch bg-destructive text-destructive-foreground">bg-destructive / text-destructive-foreground</div>
        <div class="swatch border-border">border-border</div>
        <div class="swatch border-input">border-input</div>
        <div class="swatch ring">ring</div>
      </div>
    </section>

    <section class="card section">
      <div class="title">组件样式</div>
      <div class="row gap">
        <div class="col">
          <div class="subtitle">Buttons</div>
          <div class="btns">
            <button class="btn btn-primary">Primary</button>
            <button class="btn btn-secondary">Secondary</button>
            <button class="btn btn-accent">Accent</button>
            <button class="btn btn-destructive">Destructive</button>
            <button class="btn btn-outline">Outline</button>
            <button class="btn btn-ghost">Ghost</button>
          </div>
        </div>
        <div class="col">
          <div class="subtitle">Inputs</div>
          <input class="input mb-2" placeholder="Input" />
          <select class="select mb-2">
            <option>Option A</option>
            <option>Option B</option>
            <option>Option C</option>
          </select>
          <textarea class="textarea" placeholder="Textarea" rows="3" />
        </div>
        <div class="col">
          <div class="subtitle">Checks</div>
          <label class="mr-2"><input type="checkbox" class="checkbox" /> Checkbox</label>
          <label class="mr-2"><input type="radio" class="radio" name="r" /> Radio</label>
          <div class="switch" :data-checked="true" />
        </div>
      </div>
    </section>

    <section class="card section">
      <div class="title">CSS Variables</div>
      <div class="vars">
        <div v-for="(val, key) in cssVars" :key="key" class="var-row">
          <div class="var-key">{{ key }}</div>
          <div class="var-val">{{ val }}</div>
          <div class="var-color" :style="{ background: val }" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1rem; }
.row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
.col { display: flex; flex-direction: column; }
.gap { gap: 1rem; }
.btns { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
.title { font-weight: 600; margin-bottom: .5rem; }
.subtitle { font-weight: 500; margin-bottom: .5rem; }
.hint { margin-top: .75rem; opacity: .8; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: .75rem; }
.swatch { padding: .75rem; border-radius: var(--radius); border: var(--border-width) solid var(--border); }
.vars { display: grid; grid-template-columns: 1.6fr 2.4fr .8fr; gap: .5rem; align-items: center; }
.var-row { display: contents; }
.var-key { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; opacity: .8; }
.var-val { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.var-color { height: 1.75rem; border-radius: .375rem; border: var(--border-width) solid var(--border); }
.mr-2 { margin-right: .5rem; }
.mb-2 { margin-bottom: .5rem; }
.section { padding: 1rem; margin-bottom: 1rem; }
</style>