import type { SVGProps } from "react";

export const AddFolderIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        {/* Standard Folder Shape */}
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        {/* Plus Sign */}
        <path d="M12 10v6" />
        <path d="M9 13h6" />
    </svg>
);

export const AddGroupIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        {/* Back layer (indicating depth/group) */}
        <path d="M4 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2" opacity="0.6" />

        {/* Front Folder Shape */}
        <path d="M20 20a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16Z" />

        {/* Plus Sign (slightly distinct position or style if needed, but keeping consistent is good) */}
        <path d="M12 12v4" />
        <path d="M10 14h4" />
    </svg>
);
