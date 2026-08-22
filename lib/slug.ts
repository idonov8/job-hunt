/** Stable, readable handle for a job: "Neural Frames" + "Product Engineer (Growth)" -> "neural-frames-product-engineer-growth". */
export function slugify(company: string, role: string): string {
  return `${company} ${role}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
