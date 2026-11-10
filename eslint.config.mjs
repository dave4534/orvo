import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Design system enforcement. See CLAUDE.md ("The rule").
const RAW_ELEMENTS = ["button", "input", "select", "textarea", "table", "dialog"];

const rawElementRules = RAW_ELEMENTS.map((name) => ({
  selector: `JSXOpeningElement[name.name='${name}']`,
  message: `Raw <${name}> is banned outside src/components/ui. Use the Untitled UI component from @/components/base or @/components/application, or the shadcn one from @/components/ui/*. If none fits, stop and ask, then log it in docs/exceptions.md.`,
}));

// Anything that is not shadcn/ui, Base UI or Lucide is banned. Radix is banned on purpose:
// this project is on Base UI.
const BANNED_UI_IMPORTS = [
  "@radix-ui/*",
  "radix-ui",
  "@mui/*",
  "@chakra-ui/*",
  "@mantine/*",
  "@headlessui/*",
  "@ark-ui/*",
  "@nextui-org/*",
  "@heroui/*",
  "@ariakit/*",
  "antd",
  "primereact",
  "react-bootstrap",
  "@fluentui/*",
  "@blueprintjs/*",
  "@mondaydotcomorg/*",
  "monday-ui-react-core",
  "react-icons",
  "react-icons/*",
  "@heroicons/*",
  "@phosphor-icons/*",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", "src/components/base/**", "src/components/application/**", "src/components/foundations/**", "src/components/shared-assets/**"],
    rules: {
      "no-restricted-syntax": ["error", ...rawElementRules],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: BANNED_UI_IMPORTS,
              message:
                "Only Untitled UI (@/components/base, application, react-aria-components, @untitledui/icons), @/components/ui/*, @base-ui/react and lucide-react are allowed for UI. See CLAUDE.md.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores(["src/components/base/**", "src/components/application/**", "src/components/foundations/**", "src/components/shared-assets/**", "src/utils/**", "src/hooks/use-resize-observer.ts", "src/styles/**", ".next/**", "out/**", "build/**", "next-env.d.ts", ".impeccable/**", ".claude/**"]),
]);

export default eslintConfig;
