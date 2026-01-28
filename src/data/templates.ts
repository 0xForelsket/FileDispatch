import type { Template } from "@/types";

export const TEMPLATE_CATEGORIES = [
    { id: "all", label: "All", icon: "📦" },
    { id: "photography", label: "Photography", icon: "📷" },
    { id: "finance", label: "Finance", icon: "💰" },
    { id: "development", label: "Development", icon: "💻" },
    { id: "downloads", label: "Downloads", icon: "📥" },
    { id: "general", label: "General", icon: "📁" },
    { id: "custom", label: "Custom", icon: "✨" },
] as const;

export const BUILTIN_TEMPLATES: Template[] = [
    // Photography Templates
    {
        id: "photo-sort-by-date",
        name: "Sort Photos by Date",
        description: "Automatically organize photos into year/month folders based on when they were taken or modified.",
        category: "photography",
        icon: "📅",
        tags: ["photos", "date", "organize"],
        preset: {
            id: "photo-sort-by-date",
            name: "Sort Photos by Date",
            description: "Organize photos into {year}/{month} folders",
            variables: [
                { id: "destination", name: "Destination Folder", type: "path", default: "~/Pictures/Sorted" },
            ],
            rules: [
                {
                    name: "Sort Images by Date",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "kind", kind: "image", negate: false },
                        ],
                    },
                    actions: [
                        {
                            type: "sortIntoSubfolder",
                            destination: "${destination}/{year}/{month}",
                            onConflict: "rename",
                        },
                    ],
                },
            ],
        },
    },
    {
        id: "photo-separate-raw",
        name: "Separate RAW & JPG",
        description: "Keep your RAW files separate from processed JPGs for easier editing workflow.",
        category: "photography",
        icon: "🎞️",
        tags: ["raw", "jpg", "workflow"],
        preset: {
            id: "photo-separate-raw",
            name: "Separate RAW & JPG",
            description: "Move RAW files to a dedicated folder",
            variables: [
                { id: "rawFolder", name: "RAW Files Folder", type: "path", default: "~/Pictures/RAW" },
            ],
            rules: [
                {
                    name: "Move RAW Files",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "any",
                        conditions: [
                            { type: "extension", operator: "is", value: "cr2", caseSensitive: false },
                            { type: "extension", operator: "is", value: "cr3", caseSensitive: false },
                            { type: "extension", operator: "is", value: "nef", caseSensitive: false },
                            { type: "extension", operator: "is", value: "arw", caseSensitive: false },
                            { type: "extension", operator: "is", value: "dng", caseSensitive: false },
                            { type: "extension", operator: "is", value: "raf", caseSensitive: false },
                        ],
                    },
                    actions: [
                        {
                            type: "move",
                            destination: "${rawFolder}",
                            onConflict: "rename",
                            skipDuplicates: false,
                        },
                    ],
                },
            ],
        },
    },

    // Finance Templates
    {
        id: "finance-invoices",
        name: "File Invoices",
        description: "Automatically sort invoice PDFs into organized folders by year and month.",
        category: "finance",
        icon: "🧾",
        tags: ["invoice", "pdf", "receipts"],
        preset: {
            id: "finance-invoices",
            name: "File Invoices",
            description: "Sort PDFs containing 'invoice' to Finance folder",
            variables: [
                { id: "destination", name: "Finance Folder", type: "path", default: "~/Documents/Finance" },
            ],
            rules: [
                {
                    name: "Sort Invoices",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "extension", operator: "is", value: "pdf", caseSensitive: false },
                            { type: "name", operator: "contains", value: "invoice", caseSensitive: false },
                        ],
                    },
                    actions: [
                        {
                            type: "sortIntoSubfolder",
                            destination: "${destination}/{year}/{month}",
                            onConflict: "rename",
                        },
                        {
                            type: "notify",
                            message: "Invoice filed: {fullname}",
                        },
                    ],
                },
            ],
        },
    },
    {
        id: "finance-receipts",
        name: "Organize Receipts",
        description: "Keep your receipts organized by month for easy expense tracking.",
        category: "finance",
        icon: "📋",
        tags: ["receipt", "expense", "organize"],
        preset: {
            id: "finance-receipts",
            name: "Organize Receipts",
            description: "Sort receipt files by month",
            variables: [
                { id: "destination", name: "Receipts Folder", type: "path", default: "~/Documents/Receipts" },
            ],
            rules: [
                {
                    name: "Sort Receipts",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "name", operator: "contains", value: "receipt", caseSensitive: false },
                        ],
                    },
                    actions: [
                        {
                            type: "sortIntoSubfolder",
                            destination: "${destination}/{year}/{month}",
                            onConflict: "rename",
                        },
                    ],
                },
            ],
        },
    },

    // Development Templates
    {
        id: "dev-clean-artifacts",
        name: "Clean Build Artifacts",
        description: "Automatically remove common build artifacts like .pyc, .o files, and cache directories.",
        category: "development",
        icon: "🧹",
        tags: ["clean", "build", "cache"],
        preset: {
            id: "dev-clean-artifacts",
            name: "Clean Build Artifacts",
            description: "Delete common build artifacts",
            variables: [],
            rules: [
                {
                    name: "Delete Python Cache",
                    enabled: true,
                    stopProcessing: false,
                    conditions: {
                        matchType: "any",
                        conditions: [
                            { type: "extension", operator: "is", value: "pyc", caseSensitive: false },
                            { type: "extension", operator: "is", value: "pyo", caseSensitive: false },
                            { type: "name", operator: "is", value: "__pycache__", caseSensitive: false },
                        ],
                    },
                    actions: [
                        { type: "delete", permanent: false },
                    ],
                },
                {
                    name: "Delete Object Files",
                    enabled: true,
                    stopProcessing: false,
                    conditions: {
                        matchType: "any",
                        conditions: [
                            { type: "extension", operator: "is", value: "o", caseSensitive: false },
                            { type: "extension", operator: "is", value: "obj", caseSensitive: false },
                        ],
                    },
                    actions: [
                        { type: "delete", permanent: false },
                    ],
                },
            ],
        },
    },
    {
        id: "dev-sort-by-language",
        name: "Sort by Language",
        description: "Organize source files into folders by programming language.",
        category: "development",
        icon: "📂",
        tags: ["organize", "code", "language"],
        preset: {
            id: "dev-sort-by-language",
            name: "Sort by Language",
            description: "Organize code files by language type",
            variables: [
                { id: "destination", name: "Code Folder", type: "path", default: "~/Pictures/Sorted" },
            ],
            rules: [
                {
                    name: "Sort JavaScript/TypeScript",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "any",
                        conditions: [
                            { type: "extension", operator: "is", value: "js", caseSensitive: false },
                            { type: "extension", operator: "is", value: "ts", caseSensitive: false },
                            { type: "extension", operator: "is", value: "jsx", caseSensitive: false },
                            { type: "extension", operator: "is", value: "tsx", caseSensitive: false },
                        ],
                    },
                    actions: [
                        {
                            type: "move",
                            destination: "${destination}/JavaScript",
                            onConflict: "rename",
                            skipDuplicates: false,
                        },
                    ],
                },
                {
                    name: "Sort Python",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "extension", operator: "is", value: "py", caseSensitive: false },
                        ],
                    },
                    actions: [
                        {
                            type: "move",
                            destination: "${destination}/Python",
                            onConflict: "rename",
                            skipDuplicates: false,
                        },
                    ],
                },
            ],
        },
    },

    // Downloads Templates
    {
        id: "downloads-auto-sort",
        name: "Auto-sort Downloads",
        description: "Automatically organize your Downloads folder by file type into Documents, Images, Videos, and more.",
        category: "downloads",
        icon: "📥",
        tags: ["auto", "organize", "type"],
        preset: {
            id: "downloads-auto-sort",
            name: "Auto-sort Downloads",
            description: "Sort downloads by file type",
            variables: [
                { id: "base", name: "Base Folder", type: "path", default: "~/Pictures/Sorted" },
            ],
            rules: [
                {
                    name: "Sort Documents",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "kind", kind: "document", negate: false },
                        ],
                    },
                    actions: [
                        {
                            type: "move",
                            destination: "${base}/Documents",
                            onConflict: "rename",
                            skipDuplicates: false,
                        },
                    ],
                },
                {
                    name: "Sort Images",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "kind", kind: "image", negate: false },
                        ],
                    },
                    actions: [
                        {
                            type: "move",
                            destination: "${base}/Images",
                            onConflict: "rename",
                            skipDuplicates: false,
                        },
                    ],
                },
                {
                    name: "Sort Videos",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "kind", kind: "video", negate: false },
                        ],
                    },
                    actions: [
                        {
                            type: "move",
                            destination: "${base}/Videos",
                            onConflict: "rename",
                            skipDuplicates: false,
                        },
                    ],
                },
                {
                    name: "Sort Archives",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "kind", kind: "archive", negate: false },
                        ],
                    },
                    actions: [
                        {
                            type: "move",
                            destination: "${base~/Archives",
                            onConflict: "rename",
                            skipDuplicates: false,
                        },
                    ],
                },
            ],
        },
    },
    {
        id: "downloads-clean-old",
        name: "Clean Old Downloads",
        description: "Automatically move files older than 30 days to trash to keep your Downloads folder clean.",
        category: "downloads",
        icon: "🗑️",
        tags: ["clean", "old", "delete"],
        preset: {
            id: "downloads-clean-old",
            name: "Clean Old Downloads",
            description: "Delete files older than 30 days",
            variables: [
                { id: "days", name: "Days to Keep", type: "number", default: "30" },
            ],
            rules: [
                {
                    name: "Delete Old Files",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "kind", kind: "file", negate: false },
                            { type: "dateModified", operator: { type: "notInTheLast", amount: 30, unit: "days" } },
                        ],
                    },
                    actions: [
                        { type: "delete", permanent: false },
                        { type: "notify", message: "Cleaned old file: {fullname}" },
                    ],
                },
            ],
        },
    },

    // General Templates
    {
        id: "general-screenshots",
        name: "Organize Screenshots",
        description: "Automatically move screenshots to a dedicated folder organized by date.",
        category: "general",
        icon: "📸",
        tags: ["screenshot", "organize", "date"],
        preset: {
            id: "general-screenshots",
            name: "Organize Screenshots",
            description: "Move screenshots to dedicated folder",
            variables: [
                { id: "destination", name: "Screenshots Folder", type: "path", default: "~/Pictures/Screenshots" },
            ],
            rules: [
                {
                    name: "Move Screenshots",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "kind", kind: "image", negate: false },
                            { type: "name", operator: "contains", value: "screenshot", caseSensitive: false },
                        ],
                    },
                    actions: [
                        {
                            type: "sortIntoSubfolder",
                            destination: "${destination}/{year}/{month}",
                            onConflict: "rename",
                        },
                    ],
                },
            ],
        },
    },
    {
        id: "general-archive-old",
        name: "Archive Old Files",
        description: "Compress files older than 90 days into ZIP archives to save space.",
        category: "general",
        icon: "📦",
        tags: ["archive", "zip", "compress"],
        preset: {
            id: "general-archive-old",
            name: "Archive Old Files",
            description: "Compress old files into ZIP archives",
            variables: [
                { id: "archiveFolder", name: "Archive Folder", type: "path", default: "~/Archives" },
            ],
            rules: [
                {
                    name: "Archive Old Files",
                    enabled: true,
                    stopProcessing: true,
                    conditions: {
                        matchType: "all",
                        conditions: [
                            { type: "kind", kind: "file", negate: false },
                            { type: "kind", kind: "archive", negate: true },
                            { type: "dateModified", operator: { type: "notInTheLast", amount: 90, unit: "days" } },
                        ],
                    },
                    actions: [
                        {
                            type: "archive",
                            destination: "${archiveFolder}/{year}",
                            format: "zip",
                            deleteAfter: true,
                        },
                    ],
                },
            ],
        },
    },
];

export function searchTemplates(templates: Template[], query: string): Template[] {
    if (!query.trim()) return templates;
    const lowerQuery = query.toLowerCase();
    return templates.filter(
        (t) =>
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description.toLowerCase().includes(lowerQuery) ||
            t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
}

export function filterByCategory(templates: Template[], category: string): Template[] {
    if (category === "all") return templates;
    return templates.filter((t) => t.category === category);
}
