import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STORE_STARTUP_TASK_ID } from '../electron/main/config'

const root = join(__dirname, '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

describe('GitHub vs Store packaging contracts (on-disk, not assumed)', () => {
  const pkg = JSON.parse(read('package.json')) as {
    scripts: Record<string, string>
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
    build: {
      asarUnpack: string[]
      extraResources?: Array<{ from: string; to: string }>
      files?: string[]
      appx: {
        identityName: string
        publisher: string
        applicationId: string
        displayName: string
        capabilities: string[]
        customExtensionsPath: string
        addAutoLaunchExtension?: boolean
      }
      publish: { provider: string; owner: string; repo: string }
      nsis: { artifactName: string }
    }
  }

  it('stamps buildTarget=github on the NSIS script and buildTarget=store on the AppX scripts', () => {
    expect(pkg.scripts['build:github']).toContain('--win nsis')
    expect(pkg.scripts['build:github']).toContain('buildTarget=github')
    expect(pkg.scripts['build:store']).toContain('--win appx')
    expect(pkg.scripts['build:store']).toContain('buildTarget=store')
    expect(pkg.scripts['build:msix']).toContain('--win appx')
    expect(pkg.scripts['build:msix']).toContain('buildTarget=store')
    expect(pkg.scripts['build:win']).toBe('npm run build:github')
  })

  it('declares the Store identity and required capabilities', () => {
    expect(pkg.build.appx.identityName).toBe('Eave.App')
    expect(pkg.build.appx.publisherDisplayName).toBe('Eave')
    expect(pkg.build.appx.publisher).toMatch(/^CN=/)
    expect(pkg.build.appx.applicationId).toBe('Eave')
    expect(pkg.build.appx.capabilities).toEqual(expect.arrayContaining(['runFullTrust', 'internetClient']))
    expect(pkg.build.appx.capabilities).not.toContain('broadFileSystemAccess')
  })

  it('points customExtensionsPath at a file that actually exists', () => {
    const rel = pkg.build.appx.customExtensionsPath
    expect(rel).toBeTruthy()
    expect(existsSync(join(root, rel))).toBe(true)
  })

  it('does not enable electron-builder SlackStartup auto-launch (we own the TaskId)', () => {
    expect(pkg.build.appx.addAutoLaunchExtension).not.toBe(true)
    expect(pkg.dependencies['electron-winstore-auto-launch']).toBeUndefined()
    expect(pkg.dependencies['@nodert-win10-au/windows.applicationmodel']).toBeUndefined()
  })

  it('ships the windowless StartupTask helper outside the asar', () => {
    expect(pkg.build.files).toEqual(expect.arrayContaining(['!resources/startup/**/*.exe']))
    expect(pkg.build.extraResources).toEqual(expect.arrayContaining([
      { from: 'resources/startup/EaveStartup.exe', to: 'startup/EaveStartup.exe' }
    ]))
    expect(existsSync(join(root, 'resources/startup/EaveStartup.exe'))).toBe(true)
    expect(existsSync(join(root, 'resources/startup/EaveStartup.cs'))).toBe(true)
  })

  it('keeps only runtime packages as production dependencies', () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      '@resvg/resvg-js',
      'koffi',
      'react',
      'zustand'
    ])
  })

  it('does not pack README media, Store tiles, or the full Twemoji npm tree into the asar', () => {
    expect(pkg.build.files).toEqual(expect.arrayContaining([
      '!out/renderer/**/*.gif',
      '!resources/appx/**',
      '!resources/startup/**/*.cs',
      '!**/node_modules/emoji-datasource-twitter/**',
      '!**/node_modules/gsap/**',
      '!**/node_modules/framer-motion/**',
      '!**/node_modules/@fontsource/**',
      '!**/node_modules/react-dom/**'
    ]))
    // Icons are vendored Phosphor paths (src/components/phosphorPaths.ts): no icon package at all.
    for (const dep of ['lucide-react', '@phosphor-icons/react', '@iconify/react', '@iconify-json/cuida']) {
      expect({ ...pkg.dependencies, ...pkg.devDependencies }[dep]).toBeUndefined()
    }
    expect(pkg.build.appx.customExtensionsPath).toBe('resources/appx/startup-extensions.xml')
    expect(existsSync(join(root, 'resources/appx/startup-extensions.xml'))).toBe(true)
  })

  it('ships Twemoji 64px as extraResources for GitHub and Store builds', () => {
    expect(pkg.build.extraResources).toEqual(expect.arrayContaining([
      { from: 'node_modules/emoji-datasource-twitter/img/twitter/64', to: 'emoji/64' }
    ]))
    expect(existsSync(join(root, 'node_modules/emoji-datasource-twitter/img/twitter/64'))).toBe(true)
    expect(pkg.devDependencies['emoji-datasource-twitter']).toBeTruthy()
  })

  it('keeps onboarding videos in public/ and no docs media alongside them', () => {
    const publicFiles = readdirSync(join(root, 'public'))
    expect(publicFiles.sort()).toEqual([
      'copy.webm',
      'drag.webm',
      'merge.webm',
      'preview.webm',
      'stack.webm',
      'ungroup.webm',
      'welcome.webm'
    ])
    // The app package ships onboarding media only: README screenshots, promo
    // GIFs and sponsorship QR codes no longer live in the tree at all.
    expect(publicFiles.every((name) => name.endsWith('.webm'))).toBe(true)
  })

  it('unpacks native addons the Store package must load from disk', () => {
    const unpack = pkg.build.asarUnpack.join('\n')
    expect(unpack).toMatch(/koffi/)
    expect(unpack).toMatch(/@resvg/)
    expect(unpack).toMatch(/\{node,dll\}/)
  })

  it('ships without a publish target and keeps the NSIS artifact name', () => {
    // The app no longer talks to any update service, so there is nobody to
    // publish to either.
    expect(pkg.build.publish).toBeUndefined()
    expect(pkg.build.nsis.artifactName).toContain('${version}')
    expect(pkg.build.nsis.artifactName).toMatch(/\.\$\{ext\}$/)
  })

  it('StartupTask XML uses the same TaskId as STORE_STARTUP_TASK_ID and launches Eave.exe', () => {
    const xml = read('resources/appx/startup-extensions.xml')
    expect(xml).toContain('Category="windows.startupTask"')
    expect(xml).toContain('EntryPoint="Windows.FullTrustApplication"')
    expect(xml).toContain('Executable="app\\Eave.exe"')
    expect(xml).toContain(`TaskId="${STORE_STARTUP_TASK_ID}"`)
    expect(xml).not.toContain('SlackStartup')
    expect(xml).toContain('Enabled="true"')
    expect(xml).toContain('DisplayName="檐下"')
  })

  it('electron-builder still injects customExtensionsPath into the AppX Extensions block', () => {
    const target = read('node_modules/app-builder-lib/out/targets/AppxTarget.js')
    expect(target).toContain('customExtensionsPath')
    expect(target).toContain('windows.startupTask')
    expect(target).toMatch(/extensions \+= await/)
  })

  it('main process only sets the custom AUMID on the GitHub build', () => {
    const src = read('electron/main/index.ts')
    expect(src).toMatch(/if\s*\(\s*!isStoreBuild\(\)\s*\)\s*\{[\s\S]*setAppUserModelId\('com\.eave\.app'\)/)
    expect(src).not.toMatch(/setAppUserModelId\([\s\S]*isStoreBuild\(\)/)
  })

  it('Settings ships no in-app updater surface at all', () => {
    const src = read('src/components/Settings.tsx')
    expect(src).not.toContain('autoUpdatesTitle')
    expect(src).not.toContain('hasPromotedTopUpdate')
    expect(src).not.toContain('installUpdate')
    expect(src).not.toContain('checkForUpdates')
    expect(existsSync(join(root, 'electron/main/updater.ts'))).toBe(false)
  })

  it('Settings ships no promotional surface in either packaging flavour', () => {
    const src = read('src/components/Settings.tsx')
    // Store review prompts, GitHub stars and Ko-fi links all lived in the
    // promo footer; Settings is now a pure configuration surface.
    expect(src).not.toContain('store-review-promo-btn')
    expect(src).not.toContain('ms-windows-store://review')
    expect(src).not.toContain('github-promo-btn')
    expect(src).not.toContain('github.com/Deepender25')
    expect(src).not.toContain('supporteave')
  })

})
