import type { Template } from "@/types";

const STORAGE_KEY = "filedispatch.userTemplates";

export function loadUserTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Template[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserTemplate(template: Template): Template[] {
  const current = loadUserTemplates();
  const next = [template, ...current.filter((item) => item.id !== template.id)];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("user-templates-updated"));
  return next;
}

export function removeUserTemplate(templateId: string): Template[] {
  const current = loadUserTemplates();
  const next = current.filter((item) => item.id !== templateId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("user-templates-updated"));
  return next;
}
