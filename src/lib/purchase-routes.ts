function printPath(base: string, documentNo: string) {
  return `${base}/print/${encodeURIComponent(documentNo)}`;
}

export const purchaseRoutes = {
  hub: "/purchases",
  filled: {
    list: "/purchases/filled-cylinder",
    add: "/purchases/filled-cylinder/add",
    print: (documentNo: string) => printPath("/purchases/filled-cylinder", documentNo),
  },
  empty: {
    list: "/purchases/empty-cylinder",
    add: "/purchases/empty-cylinder/add",
    print: (documentNo: string) => printPath("/purchases/empty-cylinder", documentNo),
  },
  other: {
    list: "/purchases/other",
    add: "/purchases/other/add",
    print: (documentNo: string) => printPath("/purchases/other", documentNo),
  },
  returnCylinder: {
    list: "/purchases/return-cylinder",
    print: (documentNo: string) => printPath("/purchases/return-cylinder", documentNo),
  },
  returnOther: {
    list: "/purchases/return-other",
    print: (documentNo: string) => printPath("/purchases/return-other", documentNo),
  },
} as const;
