// Pixel art for Keep the Desk Lit, copied from the design board (16x16, crisp). Placeholder art is labelled on the page.
type Layer = [fill: string, d: string];
const ART: Record<string, Layer[]> = {
 "title": [
  [
   "currentColor",
   "M10 2h2v1h-2zM9 3h1v1h-1zM12 3h1v1h-1zM8 4h1v1h-1zM13 4h1v1h-1zM7 5h8v1h-8zM7 6h1v1h-1zM6 7h1v1h-1zM5 8h1v1h-1zM4 9h1v1h-1zM4 10h1v1h-1zM4 11h1v1h-1zM4 12h1v1h-1zM2 13h6v1h-6zM2 14h6v1h-6z"
  ],
  [
   "#F2C766",
   "M10 3h2v1h-2zM9 4h4v1h-4z"
  ],
  [
   "var(--iacc,#B5573A)",
   "M9 7h1v1h-1zM11 7h1v1h-1zM13 7h1v1h-1zM9 8h1v1h-1zM11 8h1v1h-1zM13 8h1v1h-1zM11 9h1v1h-1z"
  ]
 ],
 "role1": [
  [
   "#F2C766",
   "M2 2h12v12h-12z"
  ],
  [
   "var(--color-bg-alt)",
   "M4 4h8v8h-8z"
  ],
  [
   "#E8A598",
   "M7 6h2v1h-2zM6 7h4v2h-4zM7 9h2v1h-2z"
  ],
  [
   "var(--spO,#4A3228)",
   "M1 1h14v1h-14zM1 2h1v12h-1zM14 2h1v12h-1zM1 14h14v1h-14zM3 3h10v1h-10zM3 4h1v8h-1zM12 4h1v8h-1zM3 12h10v1h-10z"
  ]
 ],
 "role2": [
  [
   "#FBE3B0",
   "M2 2h12v12h-12z"
  ],
  [
   "#F2C766",
   "M9 4h4v4h-4z"
  ],
  [
   "#E0C08C",
   "M2 11h12v3h-12z"
  ],
  [
   "var(--spO,#4A3228)",
   "M1 1h14v1h-14zM1 2h1v12h-1zM14 2h1v12h-1zM1 14h14v1h-14zM9 3h4v1h-4zM8 4h1v4h-1zM13 4h1v4h-1zM9 8h4v1h-4z"
  ]
 ],
 "board": [
  [
   "#E0C08C",
   "M2 3h2v1h-2zM5 3h5v1h-5zM11 3h3v1h-3zM2 4h1v1h-1zM7 4h2v1h-2zM13 4h1v1h-1zM2 5h1v1h-1zM7 5h2v1h-2zM13 5h1v1h-1zM2 6h1v1h-1zM7 6h2v1h-2zM13 6h1v1h-1zM2 7h1v1h-1zM7 7h2v1h-2zM13 7h1v1h-1zM2 8h5v1h-5zM8 8h6v1h-6zM2 9h3v1h-3zM11 9h3v1h-3zM2 10h3v1h-3zM11 10h3v1h-3zM2 11h3v1h-3zM11 11h3v1h-3zM2 12h3v1h-3zM11 12h3v1h-3zM2 13h12v1h-12z"
  ],
  [
   "#F2C766",
   "M4 5h2v1h-2zM4 6h2v1h-2z"
  ],
  [
   "#E8A598",
   "M10 5h2v1h-2zM10 6h2v1h-2z"
  ],
  [
   "#A8C7D6",
   "M7 10h2v1h-2zM6 11h4v1h-4z"
  ],
  [
   "var(--spO,#4A3228)",
   "M1 2h14v1h-14zM1 3h1v1h-1zM4 3h1v1h-1zM10 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM3 4h4v1h-4zM9 4h4v1h-4zM14 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM12 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM3 6h1v1h-1zM6 6h1v1h-1zM9 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM3 7h4v1h-4zM9 7h4v1h-4zM14 7h1v1h-1zM1 8h1v1h-1zM7 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM5 9h6v1h-6zM14 9h1v1h-1zM1 10h1v1h-1zM5 10h2v1h-2zM9 10h2v1h-2zM14 10h1v1h-1zM1 11h1v1h-1zM5 11h1v1h-1zM10 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM5 12h6v1h-6zM14 12h1v1h-1zM1 13h1v1h-1zM14 13h1v1h-1zM1 14h14v1h-14z"
  ]
 ],
 "games": [
  [
   "currentColor",
   "M3 2h10v1h-10zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h10v1h-10z"
  ],
  [
   "var(--ifill,#F3E6D2)",
   "M3 3h10v1h-10zM3 4h1v1h-1zM6 4h4v1h-4zM12 4h1v1h-1zM3 5h1v1h-1zM6 5h4v1h-4zM12 5h1v1h-1zM3 6h10v1h-10zM3 7h4v1h-4zM9 7h4v1h-4zM3 8h4v1h-4zM9 8h4v1h-4zM3 9h10v1h-10zM3 10h1v1h-1zM6 10h4v1h-4zM12 10h1v1h-1zM3 11h1v1h-1zM6 11h4v1h-4zM12 11h1v1h-1zM3 12h10v1h-10z"
  ],
  [
   "var(--iacc,#B5573A)",
   "M4 4h2v1h-2zM10 4h2v1h-2zM4 5h2v1h-2zM10 5h2v1h-2zM7 7h2v1h-2zM7 8h2v1h-2zM4 10h2v1h-2zM10 10h2v1h-2zM4 11h2v1h-2zM10 11h2v1h-2z"
  ]
 ],
 "desktime": [
  [
   "currentColor",
   "M6 1h4v1h-4zM7 2h2v1h-2zM5 3h6v1h-6zM12 3h1v1h-1zM4 4h1v1h-1zM11 4h1v1h-1zM13 4h1v1h-1zM3 5h1v1h-1zM12 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM2 11h1v1h-1zM13 11h1v1h-1zM3 12h1v1h-1zM12 12h1v1h-1zM4 13h1v1h-1zM11 13h1v1h-1zM5 14h6v1h-6z"
  ],
  [
   "var(--ifill,#F3E6D2)",
   "M5 4h6v1h-6zM4 5h3v1h-3zM8 5h4v1h-4zM3 6h4v1h-4zM8 6h5v1h-5zM3 7h4v1h-4zM8 7h5v1h-5zM3 8h4v1h-4zM11 8h2v1h-2zM3 9h10v1h-10zM3 10h10v1h-10zM3 11h10v1h-10zM4 12h8v1h-8zM5 13h6v1h-6z"
  ],
  [
   "var(--iacc,#B5573A)",
   "M7 5h1v1h-1zM7 6h1v1h-1zM7 7h1v1h-1zM7 8h4v1h-4z"
  ]
 ],
 "mydesk": [
  [
   "currentColor",
   "M3 1h8v1h-8zM3 2h1v1h-1zM10 2h1v1h-1zM3 3h1v1h-1zM10 3h1v1h-1zM3 4h1v1h-1zM10 4h1v1h-1zM3 5h1v1h-1zM10 5h1v1h-1zM3 6h8v1h-8zM6 7h2v1h-2zM5 8h4v1h-4zM1 9h14v1h-14zM1 10h14v1h-14zM2 11h1v1h-1zM5 11h6v1h-6zM13 11h1v1h-1zM2 12h1v1h-1zM5 12h1v1h-1zM10 12h1v1h-1zM13 12h1v1h-1zM2 13h1v1h-1zM5 13h1v1h-1zM10 13h1v1h-1zM13 13h1v1h-1zM2 14h1v1h-1zM5 14h6v1h-6zM13 14h1v1h-1z"
  ],
  [
   "var(--ifill,#F3E6D2)",
   "M4 2h6v1h-6zM4 3h6v1h-6zM4 4h6v1h-6zM4 5h6v1h-6zM6 12h1v1h-1zM9 12h1v1h-1zM6 13h4v1h-4z"
  ],
  [
   "var(--iacc,#B5573A)",
   "M12 5h2v1h-2zM12 6h3v1h-3zM12 7h3v1h-3zM12 8h2v1h-2zM7 12h2v1h-2z"
  ]
 ],
 "common": [
  [
   "currentColor",
   "M2 2h12v1h-12zM1 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM2 10h12v1h-12zM4 11h1v1h-1zM7 11h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM4 13h2v1h-2z"
  ],
  [
   "var(--ifill,#F3E6D2)",
   "M2 3h12v1h-12zM2 4h12v1h-12zM2 5h2v1h-2zM6 5h1v1h-1zM9 5h1v1h-1zM12 5h2v1h-2zM2 6h2v1h-2zM6 6h1v1h-1zM9 6h1v1h-1zM12 6h2v1h-2zM2 7h12v1h-12zM2 8h12v1h-12zM2 9h12v1h-12zM5 11h2v1h-2zM5 12h1v1h-1z"
  ],
  [
   "var(--iacc,#B5573A)",
   "M4 5h2v1h-2zM7 5h2v1h-2zM10 5h2v1h-2zM4 6h2v1h-2zM7 6h2v1h-2zM10 6h2v1h-2z"
  ]
 ],
 "discord": [
  [
   "currentColor",
   "M5 2h1v1h-1zM10 2h1v1h-1zM5 3h1v1h-1zM10 3h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM5 6h1v1h-1zM10 6h1v1h-1zM5 7h1v1h-1zM10 7h1v1h-1zM5 8h1v1h-1zM10 8h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM5 11h1v1h-1zM10 11h1v1h-1zM5 12h1v1h-1zM10 12h1v1h-1zM5 13h1v1h-1zM10 13h1v1h-1z"
  ],
  [
   "var(--iacc,#B5573A)",
   "M2 5h12v1h-12zM2 10h12v1h-12z"
  ]
 ],
 "money": [
  [
   "currentColor",
   "M10 2h2v1h-2zM9 3h1v1h-1zM12 3h1v1h-1zM8 4h1v1h-1zM13 4h1v1h-1zM7 5h8v1h-8zM7 6h1v1h-1zM6 7h1v1h-1zM5 8h1v1h-1zM4 9h1v1h-1zM4 10h1v1h-1zM4 11h1v1h-1zM4 12h1v1h-1zM2 13h6v1h-6zM2 14h6v1h-6z"
  ],
  [
   "#F2C766",
   "M10 3h2v1h-2zM9 4h4v1h-4z"
  ],
  [
   "var(--iacc,#B5573A)",
   "M9 7h1v1h-1zM11 7h1v1h-1zM13 7h1v1h-1zM9 8h1v1h-1zM11 8h1v1h-1zM13 8h1v1h-1zM11 9h1v1h-1z"
  ]
 ],
 "chev": [
  [
   "currentColor",
   "M2 5h3v1h-3zM11 5h3v1h-3zM3 6h3v1h-3zM10 6h3v1h-3zM4 7h3v1h-3zM9 7h3v1h-3zM5 8h6v1h-6zM6 9h4v1h-4z"
  ]
 ],
 "shield": [
  [
   "var(--spO,#4A3228)",
   "M2 1h12v1h-12zM2 2h1v1h-1zM13 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM2 4h1v1h-1zM13 4h1v1h-1zM2 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM13 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM2 8h1v1h-1zM13 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM3 10h1v1h-1zM12 10h1v1h-1zM4 11h1v1h-1zM11 11h1v1h-1zM5 12h1v1h-1zM10 12h1v1h-1zM6 13h1v1h-1zM9 13h1v1h-1zM7 14h2v1h-2z"
  ],
  [
   "#C4694A",
   "M4 2h8v1h-8zM4 3h3v1h-3zM9 3h3v1h-3zM3 4h3v1h-3zM7 4h2v1h-2zM10 4h2v1h-2zM3 5h2v1h-2zM6 5h4v1h-4zM11 5h1v1h-1zM3 6h4v1h-4zM9 6h3v1h-3zM3 7h3v1h-3zM7 7h2v1h-2zM10 7h2v1h-2zM3 8h2v1h-2zM6 8h4v1h-4zM11 8h1v1h-1zM3 9h9v1h-9zM4 10h7v1h-7zM5 11h5v1h-5zM6 12h3v1h-3zM7 13h2v1h-2z"
  ],
  [
   "#E8977A",
   "M3 2h1v1h-1zM3 3h1v1h-1z"
  ],
  [
   "#9A4A30",
   "M12 2h1v1h-1zM12 3h1v1h-1zM12 4h1v1h-1zM12 5h1v1h-1zM12 6h1v1h-1zM12 7h1v1h-1zM12 8h1v1h-1zM12 9h1v1h-1zM11 10h1v1h-1zM10 11h1v1h-1zM9 12h1v1h-1z"
  ],
  [
   "#FBF4E8",
   "M7 3h2v1h-2zM6 4h1v1h-1zM9 4h1v1h-1zM5 5h1v1h-1zM10 5h1v1h-1zM7 6h2v1h-2zM6 7h1v1h-1zM9 7h1v1h-1zM5 8h1v1h-1zM10 8h1v1h-1z"
  ]
 ],
 "house": [
  [
   "currentColor",
   "M7 1h2v1h-2zM6 2h4v1h-4zM5 3h2v1h-2zM9 3h2v1h-2zM4 4h2v1h-2zM10 4h2v1h-2zM3 5h2v1h-2zM11 5h2v1h-2zM2 6h2v1h-2zM12 6h2v1h-2zM1 7h14v1h-14zM3 8h1v1h-1zM12 8h1v1h-1zM3 9h1v1h-1zM12 9h1v1h-1zM3 10h1v1h-1zM12 10h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM3 12h1v1h-1zM12 12h1v1h-1zM3 13h10v1h-10z"
  ],
  [
   "var(--ifill,#F3E6D2)",
   "M4 8h8v1h-8zM4 9h8v1h-8zM4 10h2v1h-2zM10 10h2v1h-2zM4 11h2v1h-2zM10 11h2v1h-2zM4 12h2v1h-2zM10 12h2v1h-2z"
  ],
  [
   "var(--iacc,#B5573A)",
   "M6 10h4v1h-4zM6 11h4v1h-4zM6 12h4v1h-4z"
  ]
 ],
 "hash": [
  [
   "currentColor",
   "M5 2h1v1h-1zM10 2h1v1h-1zM5 3h1v1h-1zM10 3h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM5 6h1v1h-1zM10 6h1v1h-1zM5 7h1v1h-1zM10 7h1v1h-1zM5 8h1v1h-1zM10 8h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM5 11h1v1h-1zM10 11h1v1h-1zM5 12h1v1h-1zM10 12h1v1h-1zM5 13h1v1h-1zM10 13h1v1h-1z"
  ],
  [
   "var(--iacc,#B5573A)",
   "M2 5h12v1h-12zM2 10h12v1h-12z"
  ]
 ]
} as unknown as Record<string, Layer[]>;

export type KdlArtName = keyof typeof ART;

export default function KdlArt({ name, size = 32, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  const layers = ART[name];
  if (!layers) return null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" style={{ flex: "none", display: "block", ...style }}>
      {layers.map(([fill, d], i) => <path key={i} d={d} style={{ fill }} />)}
    </svg>
  );
}
