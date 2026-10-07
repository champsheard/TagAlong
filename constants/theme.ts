export const palette = {
  evergreen: "#193C32",
  evergreenDeep: "#122F28",
  oat: "#F2F0E8",
  paper: "#FBFAF5",
  citron: "#B8CE73",
  citronDark: "#6A7F3E",
  ink: "#193C32",
  muted: "#53665A",
  line: "#D7D9CB",
  paleGreen: "#E5E9DA",
  amber: "#82500B",
  amberBg: "#F6E9C9",
  red: "#8C3026",
  redBg: "#F6E2DC",
};

export const common = {
  page: { flex: 1, backgroundColor: palette.oat } as const,
  content: {
    width: "100%" as const,
    maxWidth: 680,
    alignSelf: "center" as const,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: palette.paper,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
};
