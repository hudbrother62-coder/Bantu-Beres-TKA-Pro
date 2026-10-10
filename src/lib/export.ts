function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function exportTable(
  name: string,
  rows: Record<string, unknown>[],
  headers?: string[],
) {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  const keys = headers || Object.keys(rows[0] || {});
  ws.columns = keys.map((k) => ({ header: k, key: k, width: 24 }));
  rows.forEach((r) =>
    ws.addRow(
      Object.fromEntries(
        keys.map((k) => [
          k,
          typeof r[k] === "object" ? JSON.stringify(r[k]) : (r[k] ?? ""),
        ]),
      ),
    ),
  );
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF174C86" },
  };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length + 1, 1), column: keys.length },
  };
  download(
    new Blob([(await wb.xlsx.writeBuffer()) as ArrayBuffer]),
    name + ".xlsx",
  );
}
export async function readExcel(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("File Excel maksimal 5 MB.");
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("File kosong.");
  const headers: string[] = [];
  sheet.getRow(1).eachCell((c, col) => (headers[col] = String(c.text).trim()));
  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    const r: Record<string, string> = {};
    row.eachCell((cell, col) => {
      if (headers[col]) r[headers[col]] = cell.text;
    });
    if (Object.keys(r).length) rows.push(r);
  });
  return rows;
}
export async function exportDocument(
  title: string,
  body: string,
  format: "docx" | "pdf",
  school = "",
) {
  const heading = school
    ? `${school}\nBantu Beres TKA Pro\n${title}`
    : `Bantu Beres TKA Pro\n${title}`;
  if (format === "docx") {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: heading, bold: true, size: 30 })],
            }),
            ...body
              .split("\n")
              .map((text) => new Paragraph({ children: [new TextRun(text)] })),
          ],
        },
      ],
    });
    download(await Packer.toBlob(doc), title + ".docx");
  } else {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(12);
    let y = 20;
    const lines = pdf.splitTextToSize(heading + "\n\n" + body, 175) as string[];
    for (const line of lines) {
      if (y > 277) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, 18, y);
      y += 6;
    }
    pdf.save(title + ".pdf");
  }
}
