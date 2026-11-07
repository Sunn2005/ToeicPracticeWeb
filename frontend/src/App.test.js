import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

test("session routing preserves private guards and applies the role and route language policy", async () => {
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: "custom",
    plugins: [{
      name: "session-render-test-firebase",
      enforce: "pre",
      load(id) {
        // Session state is supplied by the test; no browser Firebase initialization.
        if (id.endsWith("/src/firebase.js")) return "export const auth = {};";
      },
    }],
  });
  try {
    const { AppRoutes } = await server.ssrLoadModule("/src/App.jsx");
    const { AuthStateContext } = await server.ssrLoadModule("/src/auth/useAuth.js");
    const { LanguageProvider } = await server.ssrLoadModule("/src/i18n/LanguageContext.jsx");
    const { translations } = await server.ssrLoadModule("/src/i18n/translations.js");
    const { default: AppLanguageProvider } = await server.ssrLoadModule("/src/i18n/AppLanguageProvider.jsx");
    const { default: LanguageSwitcher } = await server.ssrLoadModule("/src/components/ui/LanguageSwitcher.jsx");
    const { useLanguage } = await server.ssrLoadModule("/src/i18n/LanguageContext.jsx");
    const render = (pathname, authLoading) => renderToStaticMarkup(
      createElement(LanguageProvider, null,
        createElement(AuthStateContext.Provider, {
          value: { user: null, profile: null, role: "", authLoading },
        }, createElement(MemoryRouter, { initialEntries: [pathname] }, createElement(AppRoutes))),
      ),
    );

    const pendingHome = render("/", true);
    assert.match(pendingHome, /id="public-main"/);
    assert.match(pendingHome, /id="features"/);
    assert.match(pendingHome, /motion-safe:animate-pulse/);
    assert.ok(pendingHome.includes(translations.en.checkingSession));
    const pendingHeader = pendingHome.slice(pendingHome.indexOf("<header"), pendingHome.indexOf("</header>"));
    assert.doesNotMatch(pendingHeader, /href="\/login"/);

    const anonymousHome = render("/", false);
    assert.match(anonymousHome, /id="public-main"/);
    assert.ok(anonymousHome.includes(translations.en.publicNavLogin));
    const anonymousHeader = anonymousHome.slice(anonymousHome.indexOf("<header"), anonymousHome.indexOf("</header>"));
    assert.match(anonymousHeader, /href="\/login"/);
    assert.doesNotMatch(anonymousHeader, /motion-safe:animate-pulse/);

    for (const pathname of ["/login", "/dashboard", "/profile", "/payment/success", "/full-test/test-1", "/full-test/attempt-1/exam", "/full-test/attempt-1/result", "/full-test/attempt-1/review", "/console/dashboard"]) {
      const pendingPage = render(pathname, true);
      assert.ok(pendingPage.includes(translations.en.checkingSession), pathname);
      assert.doesNotMatch(pendingPage, /id="public-main"/);
      assert.match(pendingPage, /brand-loader-frame/);
    }

    const renderWithPolicy = (pathname, role, content) => renderToStaticMarkup(
      createElement(AuthStateContext.Provider, {
        value: {
          user: role ? { uid: "language-test" } : null,
          profile: role ? { role } : null,
          role,
          authLoading: false,
        },
      }, createElement(MemoryRouter, { initialEntries: [pathname] },
        createElement(AppLanguageProvider, null, content),
      )),
    );
    function LanguageProbe() {
      const { language, t } = useLanguage();
      return createElement("section", { lang: language },
        t("staffProfile"), createElement(LanguageSwitcher),
      );
    }

    // Internal routes are Vietnamese even before a staff session exists.
    for (const pathname of ["/console", "/console/forgot-password", "/console/reset-password", "/console/change-password", "/console/forbidden"]) {
      const markup = renderWithPolicy(pathname, "", createElement(LanguageProbe));
      assert.match(markup, /lang="vi"/);
      assert.ok(markup.includes(translations.vi.staffProfile), pathname);
      assert.doesNotMatch(markup, /<button/);
    }
    for (const role of ["ADMIN", "EMPLOYEE"]) {
      for (const pathname of ["/console/profile", "/console/dashboard", "/console/tests/new", "/console/revenue", "/dashboard"]) {
        const markup = renderWithPolicy(pathname, role, createElement(LanguageProbe));
        assert.match(markup, /lang="vi"/);
        assert.doesNotMatch(markup, /<button/);
      }
      const profilePage = renderWithPolicy("/console/profile", role, createElement(AppRoutes));
      assert.ok(profilePage.includes(translations.vi.staffChangePassword));
      assert.ok(profilePage.includes(translations.vi.staffProfile));
      assert.ok(!profilePage.includes(translations.en.staffChangePassword));
    }
    for (const role of ["", "USER"]) {
      const markup = renderWithPolicy("/", role, createElement(LanguageProbe));
      assert.match(markup, /lang="en"/);
      assert.match(markup, /aria-label="English"/);
      assert.match(markup, /aria-label="Vietnamese"/);
    }
    const staffLogin = renderWithPolicy("/console", "", createElement(AppRoutes));
    assert.ok(staffLogin.includes(translations.vi.staffForgotPassword));

    const originalWindow = globalThis.window;
    try {
      for (const savedLanguage of ["en", "vi"]) {
        globalThis.window = { localStorage: { getItem: () => savedLanguage } };
        for (const role of ["", "USER"]) {
          const markup = renderWithPolicy("/login", role, createElement(LanguageProbe));
          assert.ok(markup.includes(`lang="${savedLanguage}"`));
          assert.ok(markup.includes(`aria-label="${translations[savedLanguage].english}"`));
          assert.ok(markup.includes(`aria-label="${translations[savedLanguage].vietnamese}"`));
        }
        for (const role of ["ADMIN", "EMPLOYEE"]) {
          const markup = renderWithPolicy("/dashboard", role, createElement(LanguageProbe));
          assert.match(markup, /lang="vi"/);
          assert.doesNotMatch(markup, /<button/);
        }
      }
    } finally {
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;
    }
  } finally {
    await server.close();
  }
});

test("mounts the Pro-gated Capy chat shell outside console routes", async () => {
  const appSource = await readFile(new URL("./App.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(appSource, /usesUserShell/);
  assert.match(appSource, /!location\.pathname\.startsWith\("\/console"\)/);
  assert.match(appSource, /<FloatingPet[\s\S]*profile=\{profile\}[\s\S]*onOpenChat=\{openChat\}/);
  assert.match(appSource, /<AIChatBox[\s\S]*open=\{open && enabled\}/);
  assert.match(appSource, /key=\{`\$\{location\.key\}:\$\{user\?\.uid \|\| "guest"\}:\$\{role\}/);
});

test("in-progress attempts show a warning without disabling general Capy chat", async () => {
  const chatSource = await readFile(
    new URL("./modules/ai-chat/components/AIChatBox.jsx", import.meta.url),
    "utf8",
  );
  const pickerSource = await readFile(
    new URL("./modules/ai-chat/components/AttemptQuestionContextPicker.jsx", import.meta.url),
    "utf8",
  );

  assert.match(chatSource, /attempts\.find\(\(\{ status \}\) => status === "IN_PROGRESS"\)/);
  assert.match(chatSource, /chatAttemptInProgressSuffix/);
  assert.match(pickerSource, /disabled=\{attempt\.status !== "COMPLETED"\}/);
  assert.match(pickerSource, /onClick=\{\(\) => onCreate\(\)\}/);
});
