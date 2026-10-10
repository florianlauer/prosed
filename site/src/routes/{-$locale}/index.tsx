import { createFileRoute, notFound } from "@tanstack/react-router";
import { Page } from "../../components/Page";
import { contentFor } from "../../content";
import { localeHead } from "../../i18n/head";
import { localeFromParam } from "../../i18n/locales";

export const Route = createFileRoute("/{-$locale}/")({
  beforeLoad: ({ params }) => {
    const locale = localeFromParam(params.locale);
    if (!locale) throw notFound();
    return { locale };
  },
  loader: ({ context }) => ({ locale: context.locale }),
  head: ({ loaderData }) =>
    loaderData
      ? localeHead({ locale: loaderData.locale, content: contentFor(loaderData.locale) })
      : {},
  component: Home,
});

function Home() {
  const { locale } = Route.useLoaderData();
  return <Page locale={locale} content={contentFor(locale)} />;
}
