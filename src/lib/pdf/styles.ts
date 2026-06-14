import { StyleSheet } from "@react-pdf/renderer";

export const base = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    padding: 36,
    color: "#1a1a1a",
  },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 16 },
  subtitle: { fontSize: 11, fontWeight: "bold", marginBottom: 8 },
  section: { marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 100, color: "#666" },
  value: { flex: 1 },
  table: { width: "100%", marginBottom: 12 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderTop: "1pt solid #e0e0e0",
    borderBottom: "1pt solid #e0e0e0",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #eeeeee",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  th: { fontWeight: "bold", fontSize: 8, color: "#555" },
  td: { fontSize: 9 },
  right: { textAlign: "right" },
  muted: { color: "#999" },
  divider: { borderTop: "1pt solid #e0e0e0", marginVertical: 8 },
  totalRow: {
    flexDirection: "row",
    borderTop: "1pt solid #333",
    paddingTop: 4,
    paddingHorizontal: 6,
    marginTop: 4,
  },
});
