import jsPDF from "jspdf";
import QRCode from "qrcode";

export async function downloadReceipt(booking) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  /* ================= BACKGROUND ================= */
  doc.setFillColor(18, 18, 18);
  doc.rect(0, 0, pageWidth, 297, "F");

  /* ================= MAIN CARD ================= */
  doc.setFillColor(30, 30, 30);
  doc.roundedRect(15, 20, pageWidth - 30, 255, 14, 14, "F");

  /* ================= HEADER ================= */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(0, 255, 200);
  doc.text("ParkEasy", 25, 38);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("PARKING RECEIPT", pageWidth - 25, 38, { align: "right" });

  doc.setDrawColor(60);
  doc.line(25, 45, pageWidth - 25, 45);

  /* ================= DATA ================= */
  const parkingName =
    booking?.parkingId?.name || booking?.parking?.name || "Parking";

  const customerName =
    booking?.customerName || booking?.userId?.name || "-";

  const email =
    booking?.customerEmail || booking?.userId?.email || "-";

  const phone =
    booking?.customerPhone || booking?.userId?.phone || "-";

  const dateText = new Date(
    booking.bookingDate || booking.createdAt
  ).toDateString();

  /* ================= TEXT HELPERS ================= */
  function leftLabel(text, x, y) {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(text, x, y);
    doc.setFontSize(11);
    doc.setTextColor(235);
  }

  function rightLabel(text, x, y) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(text, x, y);
    doc.setFontSize(11);
    doc.setTextColor(210);
  }

  /* ================= DETAILS ================= */
  let y = 60;
  const leftX = 25;
  const rightX = 90; // 🔥 FIXED
  const gap = 14;

  leftLabel("Booking ID", leftX, y);
  doc.text(booking._id, leftX, y + 6);

  rightLabel("Date", rightX, y);
  doc.text(dateText, rightX, y + 6);

  y += gap;

  leftLabel("Parking Location", leftX, y);
  doc.text(parkingName, leftX, y + 6);

  rightLabel("Time Slot", rightX, y);
  doc.text(`${booking.startTime} – ${booking.endTime}`, rightX, y + 6);

  y += gap;

  leftLabel("Customer Name", leftX, y);
  doc.text(customerName, leftX, y + 6);

  rightLabel("Duration", rightX, y);
  doc.text(`${booking.duration} hrs`, rightX, y + 6);

  y += gap;

  leftLabel("Email", leftX, y);
  doc.text(email, leftX, y + 6);

  rightLabel("Phone", rightX, y);
  doc.text(phone, rightX, y + 6);

  y += gap;

  leftLabel("Vehicle Number", leftX, y);
  doc.text(booking.vehicleNumber, leftX, y + 6);

  /* ================= QR SECTION ================= */
  const qrData = await QRCode.toDataURL(booking._id);

  const qrX = 125; // 🔥 FIXED
  const qrY = 55;

  doc.setFillColor(30, 30, 30);
  doc.roundedRect(qrX, qrY, 55, 70, 14, 14, "F");

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX + 7, qrY + 10, 41, 41, 8, 8, "F");

  doc.addImage(qrData, "PNG", qrX + 9, qrY + 12, 37, 37);

  doc.setFontSize(9);
  doc.setTextColor(160);
  doc.text(
    "Scan to verify booking",
    qrX + 27,
    qrY + 63,
    { align: "center" }
  );

  /* ================= PAYMENT SUMMARY ================= */
  y += 12;

  doc.setFillColor(22, 22, 22);
  doc.roundedRect(25, y + 12, pageWidth - 50, 55, 12, 12, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 255, 200);
  doc.text("PAYMENT SUMMARY", 35, y + 30);

  const statusColor =
    booking.status === "ACTIVE"
      ? [20, 200, 140]
      : [255, 90, 90];

  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - 95, y + 24, 55, 16, 8, 8, "F");

  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(
    booking.status,
    pageWidth - 67,
    y + 35,
    { align: "center" }
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(235);
  doc.text(
    `Rs. ${booking.totalPrice}`,
    pageWidth - 40,
    y + 52,
    { align: "right" }
  );

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140);
  doc.text(
    "Total Paid",
    pageWidth - 40,
    y + 60,
    { align: "right" }
  );

  /* ================= FOOTER ================= */
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "ParkEasy • Smart & Secure Parking Solutions",
    pageWidth / 2,
    285,
    { align: "center" }
  );

  doc.save(`ParkEasy_Receipt_${booking._id}.pdf`);
}
