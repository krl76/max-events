import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EventCategorySchema } from "@max-events/api-contracts";
import { AppAvatar, AppButton, AppChip, AppMedia, AppNavTiles, AppSection, AppSkeleton, AppState, AppText, AppTitle, CATEGORY_MEDIA_ICON } from "./primitives";

const noop = () => {};

describe("AppButton", () => {
  it("renders the default primary tone class", () => {
    const html = renderToStaticMarkup(<AppButton>Текст</AppButton>);

    expect(html).toContain("app-btn app-btn--primary");
    expect(html).toContain("Текст");
  });

  it("maps the danger tone to the max-ui destructive variant and appends className", () => {
    const html = renderToStaticMarkup(
      <AppButton tone="danger" className="extra">
        x
      </AppButton>,
    );

    expect(html).toContain("Button_variant_destructive");
    expect(html).toContain("app-btn app-btn--danger extra");
  });

  it("renders the other tones with their own modifier", () => {
    expect(renderToStaticMarkup(<AppButton tone="secondary" />)).toContain("app-btn--secondary");
    expect(renderToStaticMarkup(<AppButton tone="ghost" />)).toContain("app-btn--ghost");
  });
});

describe("toggle and state primitives", () => {
  it("exposes the pressed chip state via aria-pressed and the on-modifier", () => {
    const html = renderToStaticMarkup(<AppChip pressed>Чип</AppChip>);

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("app-chip--on");
  });

  it("keeps an unpressed chip off", () => {
    const html = renderToStaticMarkup(<AppChip>Чип</AppChip>);

    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("app-chip--on");
  });

  it("renders plain state text without the error marker", () => {
    const html = renderToStaticMarkup(<AppState>Пока пусто</AppState>);

    expect(html).toContain("app-state");
    expect(html).not.toContain("app-state--error");
    expect(html).not.toContain("app-state-icon");
  });

  it("marks the error state and renders the retry action", () => {
    const html = renderToStaticMarkup(
      <AppState error action={{ label: "Повторить", onClick: noop }}>
        Упс
      </AppState>,
    );

    expect(html).toContain("app-state--error");
    expect(html).toContain("app-state-icon");
    expect(html).toContain("Повторить");
  });
});

describe("typography and avatar", () => {
  it("renders children for both typography wrappers", () => {
    expect(renderToStaticMarkup(<AppTitle>Заголовок</AppTitle>)).toContain("Заголовок");
    expect(renderToStaticMarkup(<AppText>Текст</AppText>)).toContain("Текст");
  });

  it("spreads asChild onto the semantic heading", () => {
    const html = renderToStaticMarkup(
      <AppTitle asChild>
        <h2 className="app-section-title">Заголовок</h2>
      </AppTitle>,
    );

    expect(html).toContain("<h2");
    expect(html).toContain("app-section-title");
  });

  it("renders the avatar image when src is given", () => {
    const html = renderToStaticMarkup(<AppAvatar src="https://example.com/a.png" />);

    expect(html).toContain("<img");
    expect(html).not.toContain("AvatarText");
  });

  it("falls back to the label children without src", () => {
    const html = renderToStaticMarkup(<AppAvatar src={null}>АБ</AppAvatar>);

    expect(html).toContain("АБ");
    expect(html).not.toContain("<img");
  });
});

describe("layout primitives", () => {
  it("renders one nav tile per item with its label", () => {
    const html = renderToStaticMarkup(
      <AppNavTiles
        items={[
          { icon: "pin", label: "Первый", onClick: noop },
          { icon: "user", label: "Второй", onClick: noop },
        ]}
      />,
    );

    expect(html.match(/class="app-nav-tile"/g)).toHaveLength(2);
    expect(html).toContain("Первый");
    expect(html).toContain("Второй");
  });

  it("renders the line skeleton by default and the media variant on demand", () => {
    expect(renderToStaticMarkup(<AppSkeleton />)).toContain('class="app-skeleton-line"');
    expect(renderToStaticMarkup(<AppSkeleton variant="media" />)).toContain("app-skeleton-block--media");
  });

  it("passes the width style through and hides the skeleton from assistive tech", () => {
    const html = renderToStaticMarkup(<AppSkeleton variant="block" width="40%" />);

    expect(html).toContain('style="width:40%"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders the section head with the title as the accessible name", () => {
    const html = renderToStaticMarkup(<AppSection title="Секции">body</AppSection>);

    expect(html).toContain("app-section-title");
    expect(html).toContain('aria-label="Секции"');
  });

  it("prefers the explicit ariaLabel over the visible title", () => {
    const html = renderToStaticMarkup(
      <AppSection title="Видимый" ariaLabel="Служебный">
        body
      </AppSection>,
    );

    expect(html).toContain('aria-label="Служебный"');
    expect(html).not.toContain('aria-label="Видимый"');
  });

  it("omits the section head without a title", () => {
    const html = renderToStaticMarkup(<AppSection>body</AppSection>);

    expect(html).not.toContain("app-section-head");
    expect(html).toContain("body");
  });

  it("covers every contract category in the media icon map exactly once", () => {
    expect(Object.keys(CATEGORY_MEDIA_ICON).sort()).toEqual([...EventCategorySchema.options].sort());
  });

  it("renders the category media with its gradient class and icon", () => {
    const html = renderToStaticMarkup(<AppMedia category="sport" />);

    expect(html).toContain("app-media--sport");
    expect(html).toContain("<svg");
  });

  it("renders the neutral media placeholder without a category", () => {
    const html = renderToStaticMarkup(<AppMedia />);

    expect(html).toContain('class="app-card-media"');
    expect(html).not.toContain("<svg");
  });
});
