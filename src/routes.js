/* Every page of the site: address, design file and the title and description used for search and sharing. */
export const ROUTES = [
  {
    path: "/",
    design: "home",
    title: "GAA Group | Advisory, Compliance and Talent",
    description:
      "GAA Group brings together GAA Consulting, Filings First and Hirings First: advisory, compliance and talent for growing businesses.",
  },
  {
    path: "/about",
    design: "about",
    title: "About Us | GAA Group",
    description:
      "One group for every dimension of business growth. Learn how GAA Consulting, Filings First and Hirings First work together, plus CS articleship and careers.",
  },
  {
    path: "/team",
    design: "team",
    title: "Our Team | GAA Group",
    description:
      "Meet the professionals behind GAA Group: advisers, accountants, company secretaries and talent specialists working as one team in Bangalore.",
  },
  {
    path: "/contact",
    design: "contact",
    title: "Contact Us | GAA Group",
    description:
      "Request a fixed-scope proposal. Your enquiry goes straight to the right team at GAA Consulting, Filings First or Hirings First.",
  },
  {
    path: "/privacy",
    design: "privacy",
    title: "Privacy Notice and Terms | GAA Group",
    description:
      "How GAA Group handles personal information shared through this website, and the website terms of use.",
  },
];

export const NOT_FOUND = {
  path: "/404",
  design: "404",
  title: "Page not found | GAA Group",
  description: "The page you are looking for could not be found.",
};

export function normalise(pathname) {
  let p = (pathname || "/").replace(/\/index\.html$/i, "/").replace(/\.html$/i, "");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  if (p === "/home") p = "/";
  return p.toLowerCase();
}

export function findRoute(pathname) {
  const p = normalise(pathname);
  return ROUTES.find((r) => r.path === p) || null;
}
