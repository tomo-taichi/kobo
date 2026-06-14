import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";

const tagStyles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    width: 100,
    height: 140,
    border: "0.5pt solid #333",
    padding: 8,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  brand: { fontSize: 7, color: "#666", letterSpacing: 1 },
  productNumber: { fontSize: 11, fontWeight: "bold", marginTop: 4 },
  season: { fontSize: 8, color: "#444" },
  cleaning: { fontSize: 16, fontWeight: "bold", textAlign: "center", marginVertical: 8 },
  size: { fontSize: 8, color: "#666" },
});

const compStyles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 8,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    border: "0.5pt solid #333",
    padding: 8,
    minWidth: 80,
  },
  brand: { fontSize: 7, color: "#666", marginBottom: 6 },
  compRow: { marginBottom: 3 },
});

type ProductTagData = {
  productNumber: string | null;
  cleaningInstruction: string | null;
  seasonName: string;
  size?: string;
};

type CompositionTagData = {
  productName: string;
  compositions: string[];
};

export function ProductTagDocument({ tags }: { tags: ProductTagData[] }) {
  return (
    <Document>
      <Page size="A4" style={tagStyles.page}>
        {tags.map((tag, i) => (
          <View key={i} style={tagStyles.tag}>
            <Text style={tagStyles.brand}>taichimurakami</Text>
            <Text style={tagStyles.productNumber}>{tag.productNumber ?? "—"}</Text>
            <Text style={tagStyles.season}>{tag.seasonName}</Text>
            {tag.cleaningInstruction && (
              <Text style={tagStyles.cleaning}>{tag.cleaningInstruction}</Text>
            )}
            {tag.size && <Text style={tagStyles.size}>Size: {tag.size}</Text>}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function CompositionTagDocument({ tags }: { tags: CompositionTagData[] }) {
  return (
    <Document>
      <Page size="A4" style={compStyles.page}>
        {tags.map((tag, i) => (
          <View key={i} style={compStyles.tag}>
            <Text style={compStyles.brand}>taichimurakami</Text>
            {tag.compositions.map((c, j) => (
              <View key={j} style={compStyles.compRow}>
                <Text>{c}</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
