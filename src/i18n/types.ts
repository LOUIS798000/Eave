export interface TranslationKeys {
  filters: {
    all: string
    text: string
    links: string
    images: string
    files: string
    colors?: string
    title?: string
  }
  tabs: {
    behaviour: string
    position: string
    appearance: string
    updates?: string
    generalStartup?: string
    activationShortcuts?: string
    clipboardRules?: string
    storageRetention?: string
  }
  header: {
    searchPlaceholder: string
    settings: string
    close: string
    whatsNew: string
  }
  behaviour: {
    languageTitle: string
    languageDesc: string
    systemDefault: string
    launchAtLoginTitle: string
    launchAtLoginDesc: string
    incognitoTitle: string
    incognitoDesc: string
    hoverActivationTitle: string
    hoverActivationDescOn: string
    hoverActivationDescOff: string
    hoverDelayTitle?: string
    hoverDelayDesc?: string
    hoverDelayInstant?: string
    toggleHotkeyTitle?: string
    toggleHotkeyDesc?: string
    hotkeyEdit?: string
    hotkeyRecording?: string
    hotkeyCancel?: string
    hotkeyReset?: string
    disabledHoverOff: string
    fullscreenProtectionTitle: string
    fullscreenProtectionDesc: string
    clearUnpinnedTitle: string
    clearUnpinnedDesc: string
    movePastedToTopTitle: string
    movePastedToTopDesc: string
    soundEffectsTitle: string
    soundEffectsDesc: string
    autoDeleteTitle: string
    autoDeleteDesc: string
    never: string
    capacityTitle: string
    capacityDesc: string
    excludedAppsTitle?: string
    excludedAppsDesc?: string
    excludedAppsPlaceholder?: string
    excludedAppsAdd?: string
    excludedAppsEmpty?: string
    pinnedDefaultExpandedTitle?: string
    pinnedDefaultExpandedDesc?: string
  }
  position: {
    edgePlacementTitle: string
    edgePlacementDesc: string
    leftEdge: string
    rightEdge: string
    topEdge?: string
    bottomEdge?: string
    horizontalPositionTitle?: string
    horizontalPositionDesc?: string
    displayTitle: string
    displayDesc: string
    primaryDisplay: string
    loadingDisplays?: string
    verticalPositionTitle: string
    verticalPositionDesc: string
    top: string
    center: string
    bottom: string
    left?: string
    right?: string
    triggerZone: string
    edgeLocationHintTitle: string
    edgeLocationHintDesc: string
    edgeTriggerPositionTitle: string
    edgeTriggerPositionDesc: string
    hoverAreaSizeTitle: string
    hoverAreaSizeDesc: string
    medium: string
    edgeTriggerThicknessTitle: string
    edgeTriggerThicknessDesc: string
    panelHeightTitle: string
    panelHeightDesc: string
    panelSizeTitle?: string
    panelSizeDesc?: string
    widthLabel?: string
    heightLabel?: string
    sizeReset?: string
  }
  appearance: {
    themeTitle?: string
    themeDesc?: string
    themeSystem?: string
    themeLight?: string
    themeDark?: string
    copyIndicatorTitle: string
    copyIndicatorDesc: string
    indicatorStyleTitle: string
    indicatorStyleDesc: string
    typography: string
    textSizeTitle: string
    textSizeDesc: string
    frostTitle?: string
    frostDesc?: string
    frostOff?: string
    frostSoft?: string
    frostStrong?: string
    frostStill?: string
    frostLive?: string
    frostLiveDesc?: string
    audioAndFeedback?: string
    small?: string
    normal?: string
    default?: string
    medium: string
    large: string
    cardViewTitle: string
    cardViewDesc: string
    modernCards: string
    compactRows: string
    logoStyle: string
    tickStyle: string
    copyStyle: string
    sparkleStyle: string
    openStyleSelector?: string
    closeStyleSelector?: string
  }
  item: {
    pastePlain?: string
    copyPlain?: string
    editText?: string
    saveText?: string
    cancelEdit?: string
    plainBadge?: string
    copy: string
    copied?: string
    copiedTimes?: string
    imagePlaceholder?: string
    pinned: string
    pin: string
    unpin: string
    delete: string
    clear: string
    dropToSave: string
    dropToSaveDesc: string
    justNow: string
    ago: string
    expand: string
    textItem: string
    imageItem: string
    fileItem: string
    linkItem: string
    items: string
    recent: string
    expandPinned: string
    collapsePinned: string
    screenshot: string
    ungroup: string
    copyFilePath: string
    moreImages: string
    moreFiles: string
    singleFile: string
    scrollToTop: string
    clearLast1h?: string
    clearLast6h?: string
    clearLast24h?: string
    clearAll?: string
    clearAllConfirm?: string
  }
  emoji?: {
    open: string
    backToClipboard: string
    recents: string
    smileys: string
    people: string
    animals: string
    food: string
    travel: string
    activities: string
    objects: string
    symbols: string
    flags: string
    categories: string
    emptyRecents: string
    skinTone: string
    loadFailed: string
    prevCategory?: string
    nextCategory?: string
    clearRecents?: string
  }
  fileKinds: {
    pdf: string
    word: string
    excel: string
    powerpoint: string
    archive: string
    text: string
    code: string
    audio: string
    video: string
    image: string
    executable?: string
    folder?: string
    file: string
  }
  emptyState: {
    shelfEmpty: string
    noResultsFound: string
    shelfEmptyHint: string
    noResultsHint: string
    noClipsFound: string
    copyTypeHint: string
    textClips: string
    links: string
    images: string
    files: string
  }
  onboarding: {
    welcomeTitle: string
    welcomeDesc: string
    collectTitle: string
    collectDesc: string
    dragTitle: string
    dragDesc: string
    stacksTitle: string
    stacksDesc: string
    ungroupTitle: string
    ungroupDesc: string
    mergeTitle: string
    mergeDesc: string
    previewTitle: string
    previewDesc: string
    configTitle: string
    configDesc: string
    back: string
    next: string
    skip: string
    getStarted: string
    extractedCard: string
    dropToExtract: string
    proTips: string
    proTip1: string
    proTip2: string
    proTip3: string
    proTip4: string
  }
  tray: {
    showClipboard: string
    settings: string
    incognito: string
    hoverTrigger: string
    stickTo: string
    left: string
    right: string
    top?: string
    bottom?: string
    display: string
    quit: string
    welcomeTitle: string
    welcomeBody: string
  }
  flyout: {
    copyBeaconStyleTitle: string
    openLink: string
    copyContent: string
    saveFile: string
    extractedFromBundle: string
    itemsCount: string
    selectedCount: string
    selectAll: string
    deselectAll: string
    copySelected: string
    pasteSelected: string
    paste: string
    clearSelection: string
    contentTruncated: string
    clickToPaste: string
    copyText: string
    copyImage: string
    copyFile: string
    clickToPasteDrag: string
    clickToPasteImageDrag?: string
    openInExplorer: string
    copied?: string
    selectItem?: string
    deselectItem?: string
    clickToSelect?: string
    clickToDeselect?: string
    current: string
  }
  toast: {
    copiedToClipboard: string
    itemDeleted: string
    itemPinned: string
    itemUnpinned: string
    settingsSaved: string
    imageUnavailable?: string
    fileUnavailable?: string
    launchBlockedByWindows?: string
    launchUpdateFailed?: string
    shortcutUpdated?: string
    deleteFailed?: string
    clearFailed?: string
    pasteFallback?: string
    splitStacks?: string
    mergeTextLinks?: string
    mergeImagesFull?: string
    mergeFilesFull?: string
    mergeIncompatible?: string
    textSaved?: string
    copiedPlain?: string
    queueDone?: string
    queueAdded?: string
  }
  transform?: {
    unwrapPdf?: string
    formatJson?: string
    minifyJson?: string
    cleanUrl?: string
    dedupeLines?: string
    toggleCase?: string
    applied?: string
  }
  queue?: {
    title?: string
    hint?: string
    pasteNext?: string
    clear?: string
    toggleTooltip?: string
  }
  groups?: {
    theme?: string
    excludedApps?: string
    pinnedExpanded?: string
    feedback?: string
    aboutEave?: string
    general?: string
    startup?: string
    privacy?: string
    hoverActivation?: string
    hoverDelay?: string
    keyboardShortcut?: string
    fullscreenProtection?: string
    clipboardBehaviour?: string
    restartCleanup?: string
    storageCapacity?: string
    autoDelete?: string
    updates?: string
    placement?: string
    displayMonitor?: string
    locationHint?: string
    hoverZoneLength?: string
    triggerThickness?: string
    copyBeacon?: string
    beaconStyle?: string
    audioFeedback?: string
    frost?: string
    alignment?: string
    triggerPosition?: string
    panelHeight?: string
    windowSize?: string
    textSize?: string
    languageSelectDesc?: string
    toggleHotkeyPressDesc?: string
    edgeHintPulseDesc?: string
  }
  footer: {
    communityAndSupport: string
    feedbackTitle: string
    feedbackDesc: string
    submitFeedback: string
    applicationGroup: string
    quitTitle: string
    quitDesc: string
    supportTagline?: string
    supportPromo: string
    supportOnKofi: string
    starOnGithub: string
    reviewOnStore?: string
    githubPromo: string
    version: string
  }
}

export interface LanguageMeta {
  code: string
  name: string
  nativeName: string
  rtl?: boolean
}

export const LANGUAGES: LanguageMeta[] = [
  {
    "code": "system",
    "name": "System Default",
    "nativeName": "System Default (Auto)"
  },
  {
    "code": "en",
    "name": "English",
    "nativeName": "English (US)"
  },
  {
    "code": "es",
    "name": "Spanish",
    "nativeName": "Español"
  },
  {
    "code": "fr",
    "name": "French",
    "nativeName": "Français"
  },
  {
    "code": "de",
    "name": "German",
    "nativeName": "Deutsch"
  },
  {
    "code": "it",
    "name": "Italian",
    "nativeName": "Italiano"
  },
  {
    "code": "pt",
    "name": "Portuguese",
    "nativeName": "Português"
  },
  {
    "code": "ru",
    "name": "Russian",
    "nativeName": "Русский"
  },
  {
    "code": "ja",
    "name": "Japanese",
    "nativeName": "日本語"
  },
  {
    "code": "ko",
    "name": "Korean",
    "nativeName": "한국어"
  },
  {
    "code": "zh-CN",
    "name": "Chinese (Simplified)",
    "nativeName": "简体中文"
  },
  {
    "code": "zh-TW",
    "name": "Chinese (Traditional)",
    "nativeName": "繁體中文"
  },
  {
    "code": "hi",
    "name": "Hindi",
    "nativeName": "हिन्दी"
  },
  {
    "code": "ar",
    "name": "Arabic",
    "nativeName": "العربية",
    "rtl": true
  },
  {
    "code": "fa",
    "name": "Persian",
    "nativeName": "فارسی",
    "rtl": true
  },
  {
    "code": "bn",
    "name": "Bengali",
    "nativeName": "বাংলা"
  },
  {
    "code": "tr",
    "name": "Turkish",
    "nativeName": "Türkçe"
  },
  {
    "code": "vi",
    "name": "Vietnamese",
    "nativeName": "Tiếng Việt"
  },
  {
    "code": "pl",
    "name": "Polish",
    "nativeName": "Polski"
  },
  {
    "code": "nl",
    "name": "Dutch",
    "nativeName": "Nederlands"
  },
  {
    "code": "sv",
    "name": "Swedish",
    "nativeName": "Svenska"
  },
  {
    "code": "id",
    "name": "Indonesian",
    "nativeName": "Bahasa Indonesia"
  },
  {
    "code": "uk",
    "name": "Ukrainian",
    "nativeName": "Українська"
  },
  {
    "code": "el",
    "name": "Greek",
    "nativeName": "Ελληνικά"
  },
  {
    "code": "cs",
    "name": "Czech",
    "nativeName": "Čeština"
  },
  {
    "code": "ro",
    "name": "Romanian",
    "nativeName": "Română"
  },
  {
    "code": "hu",
    "name": "Hungarian",
    "nativeName": "Magyar"
  },
  {
    "code": "da",
    "name": "Danish",
    "nativeName": "Dansk"
  },
  {
    "code": "fi",
    "name": "Finnish",
    "nativeName": "Suomi"
  },
  {
    "code": "th",
    "name": "Thai",
    "nativeName": "ไทย"
  },
  {
    "code": "he",
    "name": "Hebrew",
    "nativeName": "עברית",
    "rtl": true
  },
  {
    "code": "no",
    "name": "Norwegian",
    "nativeName": "Norsk"
  }
];
