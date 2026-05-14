import { LayoutDashboard, ShoppingBag, Briefcase, Newspaper, Calendar, MessageSquare, Music, Camera, type LucideIcon } from "lucide-react";

export interface Template {
  id: string;
  title: string;
  tagline: string;
  icon: LucideIcon;
  prompt: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "saas-landing",
    title: "SaaS Landing",
    tagline: "Hero, features, pricing, FAQ",
    icon: LayoutDashboard,
    prompt: "Build a polished SaaS landing page for an AI-powered analytics tool. Include a bold hero with gradient, a 3-column feature grid with icons, a 3-tier pricing section, customer logo strip, FAQ accordion, and a footer. Dark theme, modern typography, subtle animations.",
  },
  {
    id: "ecommerce",
    title: "E-commerce Storefront",
    tagline: "Product grid, cart, checkout",
    icon: ShoppingBag,
    prompt: "Build a minimalist e-commerce storefront for premium streetwear. Include a hero banner, a 4-column product grid with hover effects, a slide-out cart drawer with quantity controls, product detail modal, and a clean header with search and cart icon. Use Unsplash images for products.",
  },
  {
    id: "portfolio",
    title: "Creative Portfolio",
    tagline: "Showcase work with parallax",
    icon: Briefcase,
    prompt: "Build a stunning creative portfolio for a designer. Include a full-screen hero with name and role, an asymmetric project grid with hover reveals, an about section with skills, testimonial slider, and a contact form. Editorial typography, generous whitespace, subtle parallax on scroll.",
  },
  {
    id: "blog",
    title: "Magazine Blog",
    tagline: "Editorial layout with featured post",
    icon: Newspaper,
    prompt: "Build a magazine-style blog homepage. Include a large featured article with cover image and excerpt, a 3-column grid of recent posts with categories, an author sidebar, newsletter signup, and a sticky header. Serif headlines, sans-serif body, refined spacing.",
  },
  {
    id: "booking",
    title: "Booking App",
    tagline: "Calendar with time slots",
    icon: Calendar,
    prompt: "Build a booking interface for a wellness studio. Include a service selector, an interactive calendar showing the current month, available time-slot pills for the selected day, a booking summary card, and a confirmation step. Soft palette, rounded corners.",
  },
  {
    id: "chat",
    title: "Chat Interface",
    tagline: "Conversations + sidebar",
    icon: MessageSquare,
    prompt: "Build a sleek chat interface like a messaging app. Include a sidebar with conversations list and avatars, a main chat panel with message bubbles, typing indicator, an input bar with attach button, and a top header showing the contact's status. Dark theme.",
  },
  {
    id: "music",
    title: "Music Player",
    tagline: "Player UI with library",
    icon: Music,
    prompt: "Build a music streaming player UI. Include a sidebar with playlists, a main grid of albums with cover art, a now-playing bar at the bottom with play/pause/skip, progress slider, and volume control. Use Unsplash album art. Dark glass aesthetic.",
  },
  {
    id: "gallery",
    title: "Photo Gallery",
    tagline: "Masonry with lightbox",
    icon: Camera,
    prompt: "Build an elegant photo gallery site. Include a hero with photographer's name, a masonry grid of photos that opens a lightbox on click, category filter pills at the top, and a minimal footer. Use Unsplash for photos. Black background, full-bleed imagery.",
  },
];
