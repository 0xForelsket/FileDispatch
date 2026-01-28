import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Download, Trash2, Check, Loader2, AlertCircle } from "lucide-react";

import {
    ocrFetchAvailableLanguages,
    ocrGetInstalledLanguages,
    ocrDownloadLanguage,
    ocrCancelDownload,
    ocrDeleteLanguage,
    type LanguageInfo,
    type InstalledLanguage,
} from "@/lib/tauri";

interface DownloadProgress {
    languageId: string;
    downloadedBytes: number;
    totalBytes: number;
    status: string;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LanguageManager({ disabled }: { disabled?: boolean }) {
    const [languages, setLanguages] = useState<LanguageInfo[]>([]);
    const [installedLanguages, setInstalledLanguages] = useState<InstalledLanguage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({});
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchLanguages = async () => {
        try {
            setLoading(true);
            setError(null);
            const [available, installed] = await Promise.all([
                ocrFetchAvailableLanguages(),
                ocrGetInstalledLanguages(),
            ]);
            setLanguages(available);
            setInstalledLanguages(installed);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch languages");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLanguages();

        const unlisten = listen<DownloadProgress>("ocr:download-progress", (event) => {
            const progress = event.payload;
            if (progress.status === "completed") {
                setDownloadProgress((prev) => {
                    const next = { ...prev };
                    delete next[progress.languageId];
                    return next;
                });
                fetchLanguages();
            } else if (progress.status === "cancelled") {
                setDownloadProgress((prev) => {
                    const next = { ...prev };
                    delete next[progress.languageId];
                    return next;
                });
                setError("Download cancelled");
            } else {
                setDownloadProgress((prev) => ({
                    ...prev,
                    [progress.languageId]: progress,
                }));
            }
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    const handleDownload = async (languageId: string) => {
        try {
            setDownloadProgress((prev) => ({
                ...prev,
                [languageId]: {
                    languageId,
                    downloadedBytes: 0,
                    totalBytes: 0,
                    status: "starting",
                },
            }));
            await ocrDownloadLanguage(languageId);
        } catch (err) {
            setDownloadProgress((prev) => {
                const next = { ...prev };
                delete next[languageId];
                return next;
            });
            setError(err instanceof Error ? err.message : "Download failed");
        }
    };

    const handleCancel = async (languageId: string) => {
        try {
            await ocrCancelDownload(languageId);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Cancel failed");
        }
    };

    const handleDelete = async (languageId: string) => {
        try {
            setDeletingId(languageId);
            await ocrDeleteLanguage(languageId);
            await fetchLanguages();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Delete failed");
        } finally {
            setDeletingId(null);
        }
    };

    const installedIds = new Set(installedLanguages.map((l) => l.id));

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4 text-[var(--fg-muted)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                <span className="text-sm">Loading languages…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 rounded-[var(--radius)] border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
                <button
                    className="ml-auto text-xs underline hover:no-underline"
                    onClick={() => fetchLanguages()}
                    type="button"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {languages.map((lang) => {
                const isInstalled = installedIds.has(lang.id);
                const progress = downloadProgress[lang.id];
                const isDownloading = !!progress;
                const isDeleting = deletingId === lang.id;

                return (
                    <div
                        key={lang.id}
                        className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2"
                    >
                        <div className="flex items-center gap-2">
                            {isInstalled && (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                            )}
                            <span className="text-sm font-medium text-[var(--fg-primary)]">
                                {lang.name}
                            </span>
                            <span className="text-xs text-[var(--fg-muted)]">
                                ({formatBytes(lang.sizeBytes)})
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {isDownloading ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--border-main)]">
                                        <div
                                            className="h-full bg-[var(--accent)] transition-[width] duration-200"
                                            style={{
                                                width: `${progress.totalBytes > 0 ? (progress.downloadedBytes / progress.totalBytes) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs text-[var(--fg-muted)]">
                                        {formatBytes(progress.downloadedBytes)}
                                    </span>
                                    <button
                                        className="rounded-[var(--radius)] border border-[var(--border-main)] px-2 py-1 text-[10px] font-semibold text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                                        onClick={() => handleCancel(lang.id)}
                                        type="button"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : isInstalled ? (
                                <button
                                    className="flex items-center gap-1 rounded-[var(--radius)] px-2 py-1 text-xs text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-red-400 disabled:opacity-50"
                                    onClick={() => handleDelete(lang.id)}
                                    disabled={disabled || isDeleting}
                                    type="button"
                                    title="Delete language"
                                >
                                    {isDeleting ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                                    ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            ) : (
                                <button
                                    className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
                                    onClick={() => handleDownload(lang.id)}
                                    disabled={disabled}
                                    type="button"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {languages.length === 0 && (
                <div className="py-4 text-center text-sm text-[var(--fg-muted)]">
                    No languages available. Check your internet connection.
                </div>
            )}
        </div>
    );
}
