import Link from "next/link";
import { PageHeader } from "./PageHeader";

type RelatedLink = {
  href: string;
  label: string;
};

export function ComingSoonPage({
  title,
  section,
  legacyPath,
  relatedLinks = [],
}: {
  title: string;
  section: string;
  legacyPath?: string;
  relatedLinks?: RelatedLink[];
}) {
  return (
    <>
      <PageHeader title={title} description={`${section} module aligned in navigation. Business workflow is pending implementation.`} />
      <section className="max-w-3xl rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Pending Implementation
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          This screen is included to match the client ERP menu structure. The production workflow, service logic, database writes, reports, and validation rules have not been implemented here yet.
        </p>
        {legacyPath ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Legacy route reference: <span className="font-mono text-slate-950">{legacyPath}</span>
          </div>
        ) : null}
        {relatedLinks.length > 0 ? (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="text-sm font-semibold text-slate-950">Current related screens</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {relatedLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
