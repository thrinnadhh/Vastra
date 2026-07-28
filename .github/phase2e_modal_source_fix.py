from pathlib import Path

PAGE_PATH = Path("apps/admin-dashboard/src/app/cities/page.tsx")
CONFIG_PATH = Path("eslint.config.mjs")

old_modal = (
    "  const dialog = useRef<HTMLDialogElement>(null);\n"
    "  const busyRef = useRef(busy);\n"
    "  const onCloseRef = useRef(onClose);\n"
    "  busyRef.current = busy;\n"
    "  onCloseRef.current = onClose;\n"
    "\n"
    "  useEffect(() => {\n"
    "    const element = dialog.current;\n"
    "    if (element === null) return;\n"
    "    if (!element.open) element.showModal();\n"
    "\n"
    "    const cancel = (event: Event) => {\n"
    "      event.preventDefault();\n"
    "      if (busyRef.current) return;\n"
    "      element.close();\n"
    "      onCloseRef.current();\n"
    "    };\n"
    "\n"
    "    element.addEventListener('cancel', cancel);\n"
    "    return () => {\n"
    "      element.removeEventListener('cancel', cancel);\n"
    "      if (element.open) element.close();\n"
    "    };\n"
    "  }, []);\n"
    "\n"
    "  const requestClose = () => {\n"
    "    if (busyRef.current) return;\n"
    "    if (dialog.current?.open) dialog.current.close();\n"
    "    onCloseRef.current();\n"
    "  };\n"
)

new_modal = (
    "  const dialog = useRef<HTMLDialogElement>(null);\n"
    "\n"
    "  useEffect(() => {\n"
    "    const element = dialog.current;\n"
    "    if (element === null) return;\n"
    "    if (!element.open) element.showModal();\n"
    "\n"
    "    return () => {\n"
    "      if (element.open) element.close();\n"
    "    };\n"
    "  }, []);\n"
    "\n"
    "  useEffect(() => {\n"
    "    const element = dialog.current;\n"
    "    if (element === null) return;\n"
    "\n"
    "    const cancel = (event: Event) => {\n"
    "      event.preventDefault();\n"
    "      if (busy) return;\n"
    "      element.close();\n"
    "      onClose();\n"
    "    };\n"
    "\n"
    "    element.addEventListener('cancel', cancel);\n"
    "    return () => element.removeEventListener('cancel', cancel);\n"
    "  }, [busy, onClose]);\n"
    "\n"
    "  const requestClose = () => {\n"
    "    if (busy) return;\n"
    "    if (dialog.current?.open) dialog.current.close();\n"
    "    onClose();\n"
    "  };\n"
)

page = PAGE_PATH.read_text()
count = page.count(old_modal)
if count != 1:
    raise SystemExit(f"expected one modal block, found {count}")
PAGE_PATH.write_text(page.replace(old_modal, new_modal, 1))

override = (
    "  {\n"
    "    files: ['apps/admin-dashboard/src/app/cities/page.tsx'],\n"
    "    rules: {\n"
    "      // The native dialog's cancel listener stores latest non-rendering callbacks in refs.\n"
    "      'react-hooks/refs': 'off',\n"
    "    },\n"
    "  },\n"
)

config = CONFIG_PATH.read_text()
count = config.count(override)
if count != 1:
    raise SystemExit(f"expected one scoped refs override, found {count}")
CONFIG_PATH.write_text(config.replace(override, "", 1))
