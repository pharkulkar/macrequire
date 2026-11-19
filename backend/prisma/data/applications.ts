/**
 * Application hardware requirements (seed defaults).
 *
 * HONESTY NOTE
 *  - basis VENDOR_PUBLISHED: the RAM figures (min / preferred) come from the vendor's own page (sourceUrl).
 *    cpuDemand, gpuDemand, storageGB and concurrencyFactor are still MacRequire estimates.
 *  - basis ESTIMATE: every number is a MacRequire estimate informed by typical usage. Vendors rarely publish
 *    realistic memory needs for professional workloads, so treat these as tunable defaults.
 *  All values are editable from the admin panel and are read by the scoring engine at runtime.
 *
 * Scales: cpuDemand / gpuDemand are 1 (light) to 10 (saturates a high-end chip).
 *         storageGB is the typical footprint of the app plus its working data.
 *         concurrencyFactor (0-1) is how much of the app's RAM is realistically active alongside other apps.
 */

export type Intensity = 'BASIC' | 'MODERATE' | 'HEAVY' | 'PROFESSIONAL';

export interface AppSeed {
  slug: string;
  name: string;
  category: string;
  macSupported: boolean;
  aliases?: string[];
  notes?: string;
  minRamGB: number;
  preferredRamGB: number;
  cpuDemand: number;
  gpuDemand: number;
  storageGB: number;
  intensity: Intensity;
  concurrencyFactor: number;
  needsAppleSilicon?: boolean;
  extra?: Record<string, unknown>;
  basis?: 'VENDOR_PUBLISHED' | 'ESTIMATE';
  basisNote?: string;
  sourceUrl?: string;
}

export const CATEGORIES = [
  'Development',
  'Mobile Development',
  'Virtualization & Containers',
  'AI / ML',
  'Design',
  'Photo',
  'Video',
  '3D & Animation',
  'Audio & Music',
  'Productivity',
  'Communication',
  'Browsers',
] as const;

const a = (x: AppSeed): AppSeed => x;

export const applications: AppSeed[] = [
  // ---- Development
  a({ slug: 'vscode', name: 'Visual Studio Code', category: 'Development', macSupported: true, aliases: ['vs code', 'code'], minRamGB: 4, preferredRamGB: 8, cpuDemand: 3, gpuDemand: 1, storageGB: 3, intensity: 'MODERATE', concurrencyFactor: 0.6 }),
  a({ slug: 'webstorm', name: 'WebStorm', category: 'Development', macSupported: true, aliases: ['jetbrains', 'angular', 'react'], minRamGB: 6, preferredRamGB: 12, cpuDemand: 5, gpuDemand: 1, storageGB: 4, intensity: 'MODERATE', concurrencyFactor: 0.7 }),
  a({ slug: 'intellij-idea', name: 'IntelliJ IDEA', category: 'Development', macSupported: true, aliases: ['jetbrains', 'java', 'kotlin', 'spring'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 1, storageGB: 5, intensity: 'HEAVY', concurrencyFactor: 0.75 }),
  a({ slug: 'pycharm', name: 'PyCharm', category: 'Development', macSupported: true, aliases: ['jetbrains', 'python', 'django'], minRamGB: 6, preferredRamGB: 12, cpuDemand: 5, gpuDemand: 1, storageGB: 4, intensity: 'MODERATE', concurrencyFactor: 0.7 }),
  a({ slug: 'xcode', name: 'Xcode', category: 'Mobile Development', macSupported: true, aliases: ['ios', 'swift', 'swiftui', 'apple'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 7, gpuDemand: 3, storageGB: 40, intensity: 'HEAVY', concurrencyFactor: 0.8, needsAppleSilicon: false, notes: 'Includes simulator runtimes; each extra simulator adds several GB of storage.' }),
  a({ slug: 'ios-simulator', name: 'iOS Simulator', category: 'Mobile Development', macSupported: true, aliases: ['simulator', 'iphone simulator'], minRamGB: 4, preferredRamGB: 8, cpuDemand: 4, gpuDemand: 3, storageGB: 15, intensity: 'MODERATE', concurrencyFactor: 0.7 }),
  a({ slug: 'android-studio', name: 'Android Studio', category: 'Mobile Development', macSupported: true, aliases: ['android', 'kotlin', 'gradle'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 7, gpuDemand: 2, storageGB: 20, intensity: 'HEAVY', concurrencyFactor: 0.8, notes: 'Gradle builds are memory hungry on larger projects.' }),
  a({ slug: 'android-emulator', name: 'Android Emulator', category: 'Mobile Development', macSupported: true, aliases: ['avd', 'emulator'], minRamGB: 4, preferredRamGB: 8, cpuDemand: 5, gpuDemand: 3, storageGB: 15, intensity: 'HEAVY', concurrencyFactor: 0.85, notes: 'Each running virtual device reserves its own RAM.' }),
  a({ slug: 'nodejs', name: 'Node.js (dev tooling)', category: 'Development', macSupported: true, aliases: ['node', 'npm', 'angular cli', 'webpack'], minRamGB: 2, preferredRamGB: 4, cpuDemand: 4, gpuDemand: 1, storageGB: 2, intensity: 'MODERATE', concurrencyFactor: 0.5 }),
  a({ slug: 'postgresql', name: 'PostgreSQL (local)', category: 'Development', macSupported: true, aliases: ['postgres', 'database', 'mysql'], minRamGB: 1, preferredRamGB: 4, cpuDemand: 3, gpuDemand: 1, storageGB: 5, intensity: 'MODERATE', concurrencyFactor: 0.5 }),
  a({ slug: 'postman', name: 'Postman', category: 'Development', macSupported: true, aliases: ['api testing', 'insomnia'], minRamGB: 2, preferredRamGB: 4, cpuDemand: 2, gpuDemand: 1, storageGB: 1, intensity: 'BASIC', concurrencyFactor: 0.5 }),
  a({ slug: 'iterm-terminal', name: 'Terminal / iTerm2 + Git', category: 'Development', macSupported: true, aliases: ['git', 'shell', 'cli'], minRamGB: 1, preferredRamGB: 2, cpuDemand: 2, gpuDemand: 1, storageGB: 1, intensity: 'BASIC', concurrencyFactor: 0.3 }),

  // ---- Virtualization & Containers
  a({ slug: 'docker-desktop', name: 'Docker Desktop', category: 'Virtualization & Containers', macSupported: true, aliases: ['docker', 'containers', 'kubernetes', 'compose'], minRamGB: 4, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 1, storageGB: 30, intensity: 'HEAVY', concurrencyFactor: 0.75, basis: 'VENDOR_PUBLISHED', basisNote: 'Minimum RAM from Docker\'s Mac install page. Preferred RAM reflects multi-container development and is an estimate.', sourceUrl: 'https://hub.docker.com/editions/community/docker-ce-desktop-mac', extra: { note: 'The Linux VM reserves RAM that other apps cannot use.' } }),
  a({ slug: 'parallels', name: 'Parallels Desktop', category: 'Virtualization & Containers', macSupported: true, aliases: ['vm', 'virtual machine', 'windows on mac'], minRamGB: 8, preferredRamGB: 24, cpuDemand: 7, gpuDemand: 3, storageGB: 80, intensity: 'HEAVY', concurrencyFactor: 0.9, needsAppleSilicon: false, notes: 'Runs ARM guest operating systems on Apple Silicon. Each VM reserves RAM and storage.' }),
  a({ slug: 'vmware-fusion', name: 'VMware Fusion', category: 'Virtualization & Containers', macSupported: true, aliases: ['vm', 'virtual machine'], minRamGB: 8, preferredRamGB: 24, cpuDemand: 7, gpuDemand: 3, storageGB: 80, intensity: 'HEAVY', concurrencyFactor: 0.9 }),
  a({ slug: 'utm', name: 'UTM', category: 'Virtualization & Containers', macSupported: true, aliases: ['qemu', 'virtual machine', 'vm'], minRamGB: 4, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 2, storageGB: 40, intensity: 'HEAVY', concurrencyFactor: 0.85 }),

  // ---- AI / ML
  a({ slug: 'ollama', name: 'Ollama', category: 'AI / ML', macSupported: true, aliases: ['llm', 'local ai', 'llama', 'local models'], minRamGB: 8, preferredRamGB: 32, cpuDemand: 6, gpuDemand: 8, storageGB: 40, intensity: 'PROFESSIONAL', concurrencyFactor: 0.95, needsAppleSilicon: true, notes: 'Model size drives memory: larger local models need much more unified memory.' }),
  a({ slug: 'lm-studio', name: 'LM Studio', category: 'AI / ML', macSupported: true, aliases: ['llm', 'local ai', 'local models'], minRamGB: 8, preferredRamGB: 32, cpuDemand: 6, gpuDemand: 8, storageGB: 60, intensity: 'PROFESSIONAL', concurrencyFactor: 0.95, needsAppleSilicon: true }),
  a({ slug: 'jupyter-pytorch', name: 'Jupyter / PyTorch / TensorFlow', category: 'AI / ML', macSupported: true, aliases: ['machine learning', 'ml', 'data science', 'python notebooks', 'mlx'], minRamGB: 8, preferredRamGB: 24, cpuDemand: 7, gpuDemand: 6, storageGB: 30, intensity: 'HEAVY', concurrencyFactor: 0.85, notes: 'Uses the Apple GPU through Metal/MLX; no CUDA on Mac.' }),

  // ---- Design
  a({ slug: 'figma', name: 'Figma', category: 'Design', macSupported: true, aliases: ['ui design', 'ux'], minRamGB: 4, preferredRamGB: 8, cpuDemand: 3, gpuDemand: 3, storageGB: 2, intensity: 'MODERATE', concurrencyFactor: 0.6 }),
  a({ slug: 'sketch', name: 'Sketch', category: 'Design', macSupported: true, aliases: ['ui design'], minRamGB: 4, preferredRamGB: 8, cpuDemand: 3, gpuDemand: 3, storageGB: 2, intensity: 'MODERATE', concurrencyFactor: 0.6 }),
  a({ slug: 'illustrator', name: 'Adobe Illustrator', category: 'Design', macSupported: true, aliases: ['vector', 'adobe'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 5, gpuDemand: 4, storageGB: 6, intensity: 'MODERATE', concurrencyFactor: 0.7 }),
  a({ slug: 'indesign', name: 'Adobe InDesign', category: 'Design', macSupported: true, aliases: ['layout', 'adobe'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 4, gpuDemand: 2, storageGB: 6, intensity: 'MODERATE', concurrencyFactor: 0.6 }),
  a({ slug: 'affinity-suite', name: 'Affinity Designer / Photo', category: 'Design', macSupported: true, aliases: ['affinity', 'canva alternative'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 4, gpuDemand: 4, storageGB: 5, intensity: 'MODERATE', concurrencyFactor: 0.65 }),

  // ---- Photo
  a({ slug: 'photoshop', name: 'Adobe Photoshop', category: 'Photo', macSupported: true, aliases: ['photo editing', 'adobe', 'ps'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 5, gpuDemand: 5, storageGB: 15, intensity: 'HEAVY', concurrencyFactor: 0.8 }),
  a({ slug: 'lightroom-classic', name: 'Adobe Lightroom Classic', category: 'Photo', macSupported: true, aliases: ['photo editing', 'adobe', 'raw'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 5, storageGB: 150, intensity: 'HEAVY', concurrencyFactor: 0.75, notes: 'Catalogs and RAW libraries are large; storage need depends on library size.' }),
  a({ slug: 'capture-one', name: 'Capture One', category: 'Photo', macSupported: true, aliases: ['raw', 'photo editing'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 5, storageGB: 100, intensity: 'HEAVY', concurrencyFactor: 0.75 }),

  // ---- Video
  a({ slug: 'final-cut-pro', name: 'Final Cut Pro', category: 'Video', macSupported: true, aliases: ['fcp', 'video editing', 'apple'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 7, gpuDemand: 7, storageGB: 150, intensity: 'HEAVY', concurrencyFactor: 0.85, basis: 'VENDOR_PUBLISHED', basisNote: 'RAM figures (8GB minimum, 16GB recommended) from Apple\'s Final Cut Pro tech specs. 4K/ProRes/multicam work needs more than the vendor recommendation; that adjustment is applied by workload intensity, not stored here.', sourceUrl: 'https://support.apple.com/en-gb/111903' }),
  a({ slug: 'premiere-pro', name: 'Adobe Premiere Pro', category: 'Video', macSupported: true, aliases: ['video editing', 'adobe', 'premiere'], minRamGB: 8, preferredRamGB: 24, cpuDemand: 7, gpuDemand: 7, storageGB: 150, intensity: 'HEAVY', concurrencyFactor: 0.85 }),
  a({ slug: 'after-effects', name: 'Adobe After Effects', category: 'Video', macSupported: true, aliases: ['motion graphics', 'adobe', 'vfx'], minRamGB: 16, preferredRamGB: 32, cpuDemand: 8, gpuDemand: 7, storageGB: 100, intensity: 'PROFESSIONAL', concurrencyFactor: 0.9 }),
  a({ slug: 'davinci-resolve', name: 'DaVinci Resolve', category: 'Video', macSupported: true, aliases: ['resolve', 'color grading', 'video editing', 'fusion'], minRamGB: 8, preferredRamGB: 32, cpuDemand: 7, gpuDemand: 9, storageGB: 200, intensity: 'PROFESSIONAL', concurrencyFactor: 0.9, notes: 'GPU-driven; Fusion and noise reduction increase memory use sharply.' }),
  a({ slug: 'capcut', name: 'CapCut / iMovie', category: 'Video', macSupported: true, aliases: ['imovie', 'short video', 'reels'], minRamGB: 4, preferredRamGB: 8, cpuDemand: 4, gpuDemand: 4, storageGB: 30, intensity: 'MODERATE', concurrencyFactor: 0.6 }),

  // ---- 3D & Animation
  a({ slug: 'blender', name: 'Blender', category: '3D & Animation', macSupported: true, aliases: ['3d', 'modelling', 'rendering'], minRamGB: 8, preferredRamGB: 32, cpuDemand: 8, gpuDemand: 8, storageGB: 40, intensity: 'PROFESSIONAL', concurrencyFactor: 0.9, needsAppleSilicon: true, notes: 'Recent Blender versions support Apple Silicon only.' }),
  a({ slug: 'cinema-4d', name: 'Cinema 4D', category: '3D & Animation', macSupported: true, aliases: ['c4d', '3d', 'maxon'], minRamGB: 16, preferredRamGB: 32, cpuDemand: 8, gpuDemand: 7, storageGB: 40, intensity: 'PROFESSIONAL', concurrencyFactor: 0.9 }),
  a({ slug: 'maya', name: 'Autodesk Maya', category: '3D & Animation', macSupported: true, aliases: ['3d', 'animation', 'autodesk'], minRamGB: 16, preferredRamGB: 32, cpuDemand: 8, gpuDemand: 7, storageGB: 50, intensity: 'PROFESSIONAL', concurrencyFactor: 0.9 }),
  a({ slug: 'unity-unreal', name: 'Unity / Unreal Engine', category: '3D & Animation', macSupported: true, aliases: ['game dev', 'unity', 'unreal'], minRamGB: 16, preferredRamGB: 32, cpuDemand: 8, gpuDemand: 8, storageGB: 100, intensity: 'PROFESSIONAL', concurrencyFactor: 0.9 }),

  // ---- Audio
  a({ slug: 'logic-pro', name: 'Logic Pro', category: 'Audio & Music', macSupported: true, aliases: ['music production', 'daw', 'apple'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 2, storageGB: 80, intensity: 'HEAVY', concurrencyFactor: 0.8, notes: 'Large sample libraries and plugin counts raise memory and storage needs.' }),
  a({ slug: 'ableton-live', name: 'Ableton Live', category: 'Audio & Music', macSupported: true, aliases: ['music production', 'daw'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 1, storageGB: 50, intensity: 'HEAVY', concurrencyFactor: 0.75 }),

  // ---- Productivity
  a({ slug: 'microsoft-office', name: 'Microsoft Office', category: 'Productivity', macSupported: true, aliases: ['word', 'excel', 'powerpoint', 'microsoft 365'], minRamGB: 4, preferredRamGB: 8, cpuDemand: 2, gpuDemand: 1, storageGB: 10, intensity: 'BASIC', concurrencyFactor: 0.5, notes: 'Very large Excel models need more memory than typical documents.' }),
  a({ slug: 'iwork', name: 'Pages / Numbers / Keynote', category: 'Productivity', macSupported: true, aliases: ['apple office', 'iwork'], minRamGB: 4, preferredRamGB: 8, cpuDemand: 2, gpuDemand: 1, storageGB: 5, intensity: 'BASIC', concurrencyFactor: 0.4 }),
  a({ slug: 'notion-obsidian', name: 'Notion / Obsidian', category: 'Productivity', macSupported: true, aliases: ['notes', 'notion', 'obsidian'], minRamGB: 2, preferredRamGB: 4, cpuDemand: 2, gpuDemand: 1, storageGB: 2, intensity: 'BASIC', concurrencyFactor: 0.4 }),
  a({ slug: 'zotero-research', name: 'Zotero / Research tools', category: 'Productivity', macSupported: true, aliases: ['academic', 'research', 'citations', 'latex'], minRamGB: 2, preferredRamGB: 4, cpuDemand: 2, gpuDemand: 1, storageGB: 5, intensity: 'BASIC', concurrencyFactor: 0.4 }),
  a({ slug: 'matlab-rstudio', name: 'MATLAB / RStudio', category: 'Productivity', macSupported: true, aliases: ['matlab', 'r', 'statistics', 'engineering'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 2, storageGB: 25, intensity: 'HEAVY', concurrencyFactor: 0.7 }),

  // ---- Communication
  a({ slug: 'zoom', name: 'Zoom', category: 'Communication', macSupported: true, aliases: ['video calls', 'meetings'], minRamGB: 2, preferredRamGB: 4, cpuDemand: 3, gpuDemand: 1, storageGB: 1, intensity: 'BASIC', concurrencyFactor: 0.5 }),
  a({ slug: 'teams-slack', name: 'Microsoft Teams / Slack', category: 'Communication', macSupported: true, aliases: ['teams', 'slack', 'chat', 'meetings'], minRamGB: 2, preferredRamGB: 4, cpuDemand: 3, gpuDemand: 1, storageGB: 2, intensity: 'BASIC', concurrencyFactor: 0.6 }),

  // ---- Browsers
  a({ slug: 'chrome', name: 'Google Chrome', category: 'Browsers', macSupported: true, aliases: ['browser', 'web', 'tabs'], minRamGB: 2, preferredRamGB: 6, cpuDemand: 3, gpuDemand: 2, storageGB: 1, intensity: 'MODERATE', concurrencyFactor: 0.7, notes: 'Memory use scales with open tabs and extensions.' }),
  a({ slug: 'safari', name: 'Safari', category: 'Browsers', macSupported: true, aliases: ['browser', 'web'], minRamGB: 2, preferredRamGB: 4, cpuDemand: 2, gpuDemand: 2, storageGB: 1, intensity: 'BASIC', concurrencyFactor: 0.5 }),

  // ---- Not available natively on macOS (kept so compatibility warnings can be shown)
  a({ slug: 'visual-studio', name: 'Visual Studio (full IDE)', category: 'Development', macSupported: false, aliases: ['dotnet', '.net', 'c#', 'msvc'], minRamGB: 8, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 1, storageGB: 30, intensity: 'HEAVY', concurrencyFactor: 0.8, notes: 'No current macOS version. Visual Studio Code or JetBrains Rider are the usual alternatives; Windows can run in a VM.' }),
  a({ slug: 'solidworks', name: 'SolidWorks', category: '3D & Animation', macSupported: false, aliases: ['cad', 'engineering'], minRamGB: 16, preferredRamGB: 32, cpuDemand: 7, gpuDemand: 6, storageGB: 30, intensity: 'HEAVY', concurrencyFactor: 0.85, notes: 'Windows-only. Running it in a VM on Apple Silicon is not a supported setup.' }),
  a({ slug: 'revit', name: 'Autodesk Revit', category: '3D & Animation', macSupported: false, aliases: ['bim', 'architecture', 'autodesk'], minRamGB: 16, preferredRamGB: 32, cpuDemand: 7, gpuDemand: 6, storageGB: 30, intensity: 'HEAVY', concurrencyFactor: 0.85, notes: 'Windows-only.' }),
  a({ slug: 'ms-access', name: 'Microsoft Access', category: 'Productivity', macSupported: false, aliases: ['database', 'office'], minRamGB: 4, preferredRamGB: 8, cpuDemand: 2, gpuDemand: 1, storageGB: 2, intensity: 'BASIC', concurrencyFactor: 0.4, notes: 'Windows-only.' }),
];

export interface UseCaseSeed {
  slug: string;
  name: string;
  description: string;
  appCategories: string[];
  /** Application slugs preselected when a visitor starts from this use case: a typical minimum set, not everything the use case could involve. */
  starterApps: string[];
  /** Scoring emphasis multipliers by category key. 1.0 = neutral. Tunable defaults, not measurements. */
  weights: Partial<Record<'cpu' | 'gpu' | 'ram' | 'storage' | 'compatibility' | 'budget' | 'portability' | 'battery' | 'future', number>>;
}

export const useCases: UseCaseSeed[] = [
  { slug: 'software-development', name: 'Software Development', description: 'General programming, IDEs, tooling and local servers.', appCategories: ['Development', 'Virtualization & Containers', 'Browsers'], starterApps: ['vscode', 'docker-desktop', 'iterm-terminal', 'postman', 'chrome'], weights: { cpu: 1.2, ram: 1.3, storage: 1.1 } },
  { slug: 'frontend-development', name: 'Frontend Development', description: 'Web UIs, bundlers and browser testing.', appCategories: ['Development', 'Browsers', 'Design'], starterApps: ['vscode', 'nodejs', 'figma', 'chrome'], weights: { cpu: 1.1, ram: 1.2 } },
  { slug: 'backend-development', name: 'Backend Development', description: 'APIs, databases and containers.', appCategories: ['Development', 'Virtualization & Containers'], starterApps: ['vscode', 'docker-desktop', 'postgresql', 'postman'], weights: { cpu: 1.2, ram: 1.4, storage: 1.1 } },
  { slug: 'full-stack-development', name: 'Full Stack Development', description: 'Frontend, backend and databases together.', appCategories: ['Development', 'Virtualization & Containers', 'Browsers'], starterApps: ['vscode', 'docker-desktop', 'postgresql', 'chrome'], weights: { cpu: 1.2, ram: 1.4, storage: 1.1 } },
  { slug: 'android-development', name: 'Android Development', description: 'Android Studio, Gradle and emulators.', appCategories: ['Mobile Development', 'Development', 'Virtualization & Containers'], starterApps: ['android-studio', 'android-emulator'], weights: { cpu: 1.3, ram: 1.5, storage: 1.2 } },
  { slug: 'ios-development', name: 'iOS Development', description: 'Xcode, simulators and Swift builds.', appCategories: ['Mobile Development', 'Development'], starterApps: ['xcode', 'ios-simulator'], weights: { cpu: 1.3, ram: 1.3, storage: 1.3 } },
  { slug: 'ai-ml-development', name: 'AI/ML Development', description: 'Notebooks, training and local model inference.', appCategories: ['AI / ML', 'Development', 'Virtualization & Containers'], starterApps: ['jupyter-pytorch', 'ollama', 'vscode', 'docker-desktop'], weights: { cpu: 1.1, gpu: 1.4, ram: 1.7, storage: 1.3, future: 1.3 } },
  { slug: 'video-editing', name: 'Video Editing', description: 'Timelines, color grading and exports.', appCategories: ['Video', 'Audio & Music'], starterApps: ['final-cut-pro', 'premiere-pro'], weights: { cpu: 1.2, gpu: 1.5, ram: 1.3, storage: 1.5 } },
  { slug: 'photo-editing', name: 'Photo Editing', description: 'RAW workflows and retouching.', appCategories: ['Photo', 'Design'], starterApps: ['lightroom-classic', 'photoshop'], weights: { gpu: 1.2, ram: 1.2, storage: 1.4 } },
  { slug: 'graphic-design', name: 'Graphic Design', description: 'Vector, layout and UI design.', appCategories: ['Design', 'Photo'], starterApps: ['photoshop', 'illustrator', 'figma'], weights: { gpu: 1.2, ram: 1.2 } },
  { slug: '3d-modelling', name: '3D Modelling', description: 'Modelling, rendering and animation.', appCategories: ['3D & Animation', 'Video'], starterApps: ['blender', 'maya'], weights: { cpu: 1.3, gpu: 1.6, ram: 1.4, storage: 1.2 } },
  { slug: 'music-production', name: 'Music Production', description: 'DAWs, plugins and sample libraries.', appCategories: ['Audio & Music'], starterApps: ['logic-pro', 'ableton-live'], weights: { cpu: 1.3, ram: 1.2, storage: 1.4 } },
  { slug: 'business-office', name: 'Business & Office Work', description: 'Documents, spreadsheets, meetings and email.', appCategories: ['Productivity', 'Communication', 'Browsers'], starterApps: ['microsoft-office', 'teams-slack', 'zoom', 'chrome'], weights: { battery: 1.3, portability: 1.2, budget: 1.2 } },
  { slug: 'browsing-entertainment', name: 'Browsing and Entertainment', description: 'Web, streaming and light media.', appCategories: ['Browsers', 'Communication'], starterApps: ['chrome', 'safari'], weights: { battery: 1.3, portability: 1.2, budget: 1.3 } },
  { slug: 'student-academic', name: 'Student / Academic Work', description: 'Notes, research, assignments and light projects.', appCategories: ['Productivity', 'Browsers', 'Communication'], starterApps: ['microsoft-office', 'zotero-research', 'chrome', 'zoom'], weights: { battery: 1.4, portability: 1.3, budget: 1.4 } },
  { slug: 'general-purpose', name: 'General Purpose', description: 'A bit of everything.', appCategories: ['Productivity', 'Browsers', 'Communication'], starterApps: ['chrome', 'microsoft-office', 'zoom'], weights: { battery: 1.2, budget: 1.2 } },
];
