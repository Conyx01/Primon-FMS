export function certificateFilename(
  certificateNumber?: string,
  workOrderCode?: string,
  variant?: string
) {
  const id = (certificateNumber || workOrderCode || "certificate").replace(/[^\w.-]+/g, "-");
  if (variant === "pmi_crest") return `PMI-Crest-${id}.pdf`;
  if (variant === "primon_logo") return `Primon-PMI-${id}.pdf`;
  if (variant) return `Primon-${variant}-${id}.pdf`;
  return `Primon-${id}.pdf`;
}

function waitForImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll("img"));
  return Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    })
  );
}

/**
 * Capture a certificate sheet and save it as a single A4 PDF page.
 * The image is scaled to fit — a second page is never added.
 */
export async function downloadCertificatePdf(element: HTMLElement, filename: string) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await waitForImages(element);

  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 4000,
    onclone(_doc, cloned) {
      cloned.style.boxShadow = "none";
      cloned.style.transform = "none";
      cloned.style.margin = "0";
    },
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const imgRatio = canvas.width / canvas.height;

  let width = usableWidth;
  let height = width / imgRatio;
  if (height > usableHeight) {
    height = usableHeight;
    width = height * imgRatio;
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const x = (pageWidth - width) / 2;
  const y = margin;
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, width, height, undefined, "MEDIUM");
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
