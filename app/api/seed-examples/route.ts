import { NextResponse } from "next/server";

import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/db";

const EXAMPLES = [
  {
    title: "SaaS Analytics Dashboard",
    industryTag: "SaaS",
    slug: "saas-analytics",
    prompt:
      "A modern SaaS analytics dashboard landing page with a dark theme, a hero section showing a glowing chart mockup, feature grids with tech icons, and a pricing table. Use tailwindcss and make it look very premium.",
    generatedCode: `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: { colors: { brand: '#3b82f6' } } }
    }
  </script>
</head>
<body class="bg-gray-950 text-white font-sans antialiased">
  <nav class="border-b border-white/10 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="font-bold text-xl flex items-center gap-2">
        <div class="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">M</div> MetricFlow
      </div>
      <div class="hidden md:flex gap-8 text-sm text-gray-400">
        <a href="#" class="hover:text-white">Features</a>
        <a href="#" class="hover:text-white">Pricing</a>
        <a href="#" class="hover:text-white">Docs</a>
      </div>
      <button class="bg-white text-black px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-200">Start Free Trial</button>
    </div>
  </nav>

  <main class="max-w-7xl mx-auto px-6 py-24 text-center">
    <div class="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm mb-8 text-blue-400">
      ✨ Announcing AI-powered insights
    </div>
    <h1 class="text-5xl md:text-7xl font-bold tracking-tight mb-6">
      Understand your data at the <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">speed of thought</span>.
    </h1>
    <p class="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
      Unify your product, marketing, and revenue data in one place. MetricFlow gives you answers before you even ask the questions.
    </p>
    <div class="flex gap-4 justify-center">
      <button class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium">Get Started</button>
      <button class="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-8 py-3 rounded-lg font-medium">Book Demo</button>
    </div>

    <div class="mt-24 relative rounded-xl border border-white/10 bg-gray-900 shadow-2xl p-4 overflow-hidden aspect-video">
      <div class="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent z-10 h-full"></div>
      <div class="flex h-full gap-4 opacity-50">
        <div class="w-64 border-r border-white/10 flex flex-col gap-4">
          <div class="h-8 bg-white/5 rounded"></div>
          <div class="h-8 bg-white/5 rounded"></div>
          <div class="h-8 bg-white/5 rounded"></div>
        </div>
        <div class="flex-1 flex flex-col gap-4">
          <div class="flex gap-4">
             <div class="flex-1 h-24 bg-white/5 rounded border border-white/5"></div>
             <div class="flex-1 h-24 bg-white/5 rounded border border-white/5"></div>
             <div class="flex-1 h-24 bg-white/5 rounded border border-white/5"></div>
          </div>
          <div class="flex-1 bg-white/5 rounded border border-white/5 relative overflow-hidden">
             <!-- Fake Chart -->
             <svg viewBox="0 0 100 100" class="w-full h-full preserve-aspect-ratio-none stroke-blue-500 fill-blue-500/20" stroke-width="2">
               <path d="M0,100 L0,80 Q25,60 50,70 T100,30 L100,100 Z" />
             </svg>
          </div>
        </div>
      </div>
    </div>
  </main>
</body>
</html>`,
  },
  {
    title: "Artisan Coffee Roasters",
    industryTag: "Ecommerce",
    slug: "coffee-ecommerce",
    prompt:
      "An elegant, minimalist ecommerce store for an artisan coffee roaster. Use a warm, earthy color palette (creams, browns). Show a hero image of coffee beans, a featured products grid, and a sleek modern typography layout.",
    generatedCode: `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #faf8f5; color: #2c2420; }
    h1, h2, h3, .serif { font-family: 'Playfair Display', serif; }
  </style>
</head>
<body>
  <header class="py-6 px-8 flex justify-between items-center border-b border-[#e8e4db]">
    <div class="text-2xl font-bold serif tracking-wider uppercase">Onyx & Oak</div>
    <nav class="hidden md:flex gap-8 text-sm uppercase tracking-widest text-[#5c4f48]">
      <a href="#" class="hover:text-black">Shop</a>
      <a href="#" class="hover:text-black">Subscriptions</a>
      <a href="#" class="hover:text-black">Our Story</a>
    </nav>
    <button class="text-sm uppercase tracking-widest font-medium border-b border-black pb-1">Cart (0)</button>
  </header>

  <section class="flex flex-col md:flex-row min-h-[80vh]">
    <div class="flex-1 flex flex-col justify-center p-12 md:p-24">
      <p class="text-sm uppercase tracking-widest text-[#8c7a6b] mb-4">Single Origin & Blends</p>
      <h1 class="text-6xl md:text-7xl font-bold leading-tight mb-6">Roasted for<br>the ritual.</h1>
      <p class="text-lg text-[#5c4f48] mb-10 max-w-md leading-relaxed">
        We ethically source the world's finest beans and roast them in small batches to highlight their natural terroir.
      </p>
      <a href="#" class="bg-[#2c2420] text-white px-8 py-4 w-max text-sm uppercase tracking-widest hover:bg-black transition-colors">Shop Coffee</a>
    </div>
    <div class="flex-1 bg-[#e8e4db] relative overflow-hidden">
      <!-- Placeholder for a beautiful coffee image -->
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=1000&auto=format&fit=crop'); mix-blend-mode: multiply; opacity: 0.8;"></div>
    </div>
  </section>

  <section class="py-24 px-8 max-w-7xl mx-auto">
    <h2 class="text-4xl text-center mb-16 serif">Featured Roasts</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
      <div class="group cursor-pointer">
        <div class="aspect-[3/4] bg-[#eae5dc] mb-6 flex items-center justify-center p-8 transition-transform group-hover:scale-[1.02]">
           <div class="w-full h-full bg-[#c9b7a7] rounded-sm shadow-xl"></div>
        </div>
        <h3 class="text-xl serif font-bold">Ethiopia Yirgacheffe</h3>
        <p class="text-[#8c7a6b] text-sm mt-2">Jasmine, Bergamot, Honey</p>
        <p class="mt-3 font-medium">$22.00</p>
      </div>
      <div class="group cursor-pointer">
        <div class="aspect-[3/4] bg-[#eae5dc] mb-6 flex items-center justify-center p-8 transition-transform group-hover:scale-[1.02]">
           <div class="w-full h-full bg-[#8c7a6b] rounded-sm shadow-xl"></div>
        </div>
        <h3 class="text-xl serif font-bold">Colombia Supremo</h3>
        <p class="text-[#8c7a6b] text-sm mt-2">Dark Chocolate, Cherry</p>
        <p class="mt-3 font-medium">$19.00</p>
      </div>
      <div class="group cursor-pointer">
        <div class="aspect-[3/4] bg-[#eae5dc] mb-6 flex items-center justify-center p-8 transition-transform group-hover:scale-[1.02]">
           <div class="w-full h-full bg-[#4a3f35] rounded-sm shadow-xl"></div>
        </div>
        <h3 class="text-xl serif font-bold">Midnight Blend</h3>
        <p class="text-[#8c7a6b] text-sm mt-2">Molasses, Smoke, Cocoa</p>
        <p class="mt-3 font-medium">$20.00</p>
      </div>
    </div>
  </section>
</body>
</html>`,
  },
  {
    title: "Creative Agency Portfolio",
    industryTag: "Portfolio",
    slug: "creative-portfolio",
    prompt:
      "A bold, brutalist-inspired creative agency portfolio. Huge typography, sharp contrasting colors like neon green and black, a marquee scrolling text, and large project thumbnails. Very avant-garde.",
    generatedCode: `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Space Grotesk', sans-serif; background-color: #000; color: #ccff00; }
    .marquee { white-space: nowrap; overflow: hidden; box-sizing: border-box; }
    .marquee span { display: inline-block; padding-left: 100%; animation: marquee 15s linear infinite; }
    @keyframes marquee { 0% { transform: translate(0, 0); } 100% { transform: translate(-100%, 0); } }
    .stroke-text { -webkit-text-stroke: 1px #ccff00; color: transparent; }
  </style>
</head>
<body class="selection:bg-[#ccff00] selection:text-black">
  <nav class="p-6 flex justify-between border-b border-[#ccff00]/30 mix-blend-difference z-50 sticky top-0 bg-black">
    <div class="text-2xl font-bold uppercase tracking-tighter">Studio Zero</div>
    <div class="uppercase font-bold hover:bg-[#ccff00] hover:text-black px-4 py-1 transition-colors cursor-pointer">Contact</div>
  </nav>

  <main class="min-h-[80vh] flex flex-col justify-center px-6">
    <h1 class="text-[10vw] font-bold leading-[0.8] uppercase tracking-tighter">
      We make <br>
      <span class="stroke-text hover:text-[#ccff00] transition-colors">digital noise</span>
    </h1>
    <div class="mt-12 max-w-xl text-xl leading-tight">
      A radical design practice based in Tokyo and London. We build brutal, beautiful internet experiences for brands that aren't afraid.
    </div>
  </main>

  <div class="border-y border-[#ccff00] py-4 bg-[#ccff00] text-black font-bold uppercase text-2xl marquee overflow-hidden">
    <span>SELECTED WORKS 2024 +++ SELECTED WORKS 2024 +++ SELECTED WORKS 2024 +++ SELECTED WORKS 2024 +++</span>
  </div>

  <section class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
    <div class="group cursor-pointer">
      <div class="aspect-square bg-zinc-900 border border-[#ccff00]/30 group-hover:border-[#ccff00] transition-colors overflow-hidden relative">
         <div class="absolute inset-0 bg-[#ccff00] translate-y-full group-hover:translate-y-0 transition-transform duration-500 flex items-center justify-center">
            <span class="text-black text-4xl font-bold uppercase">View Project</span>
         </div>
      </div>
      <div class="flex justify-between items-end mt-4">
        <h2 class="text-3xl font-bold uppercase">Cyberpunk 2077</h2>
        <span class="opacity-50">Web Design</span>
      </div>
    </div>
    <div class="group cursor-pointer mt-0 md:mt-24">
      <div class="aspect-square bg-zinc-900 border border-[#ccff00]/30 group-hover:border-[#ccff00] transition-colors overflow-hidden relative">
         <div class="absolute inset-0 bg-[#ccff00] translate-y-full group-hover:translate-y-0 transition-transform duration-500 flex items-center justify-center">
            <span class="text-black text-4xl font-bold uppercase">View Project</span>
         </div>
      </div>
      <div class="flex justify-between items-end mt-4">
        <h2 class="text-3xl font-bold uppercase">Nike ACG</h2>
        <span class="opacity-50">Campaign</span>
      </div>
    </div>
  </section>
</body>
</html>`,
  },
  {
    title: "Osteria Italian Restaurant",
    industryTag: "Restaurant",
    slug: "italian-osteria",
    prompt:
      "A warm, inviting website for an upscale Italian restaurant. Use deep reds, olive greens, and cream colors. Include a hero section with a reservation button, a featured menu section, and high-end typography.",
    generatedCode: `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Lato:wght@300;400&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Lato', sans-serif; background-color: #fcf9f2; color: #2d3725; }
    h1, h2, h3, .serif { font-family: 'Cormorant Garamond', serif; }
  </style>
</head>
<body>
  <nav class="absolute top-0 w-full p-8 z-10 flex justify-between items-center text-[#fcf9f2]">
    <div class="hidden md:flex gap-8 uppercase tracking-widest text-xs">
      <a href="#" class="hover:text-[#a62b2b] transition-colors">Menu</a>
      <a href="#" class="hover:text-[#a62b2b] transition-colors">Wine List</a>
    </div>
    <div class="text-4xl serif font-semibold tracking-wide mx-auto md:mx-0">OSTERIA</div>
    <div class="hidden md:block">
      <a href="#" class="border border-[#fcf9f2] px-6 py-2 uppercase tracking-widest text-xs hover:bg-[#fcf9f2] hover:text-[#2d3725] transition-colors">Book a Table</a>
    </div>
  </nav>

  <header class="h-screen relative flex items-center justify-center text-center px-4">
    <div class="absolute inset-0 bg-[#2d3725]">
      <!-- Placeholder image -->
      <div class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
    </div>
    <div class="relative z-10 text-[#fcf9f2] max-w-2xl">
      <span class="uppercase tracking-[0.3em] text-sm mb-4 block text-[#d4c3a3]">Since 1982</span>
      <h1 class="text-6xl md:text-8xl serif mb-6 leading-none">Authentic Taste of Roma</h1>
      <p class="text-lg md:text-xl font-light mb-10 text-white/80">Handmade pasta, wood-fired pizzas, and an award-winning wine cellar in the heart of the city.</p>
      <a href="#" class="bg-[#a62b2b] text-[#fcf9f2] px-8 py-4 uppercase tracking-widest text-sm hover:bg-[#8a2222] transition-colors">Make a Reservation</a>
    </div>
  </header>

  <section class="py-24 px-6 max-w-4xl mx-auto text-center">
    <h2 class="text-4xl md:text-5xl serif text-[#a62b2b] mb-16">I Classici</h2>
    <div class="space-y-12 text-left">
      <div class="flex justify-between items-end border-b border-[#2d3725]/10 pb-4">
        <div>
          <h3 class="text-2xl serif mb-2">Cacio e Pepe</h3>
          <p class="text-sm opacity-70">Tonnarelli, pecorino romano, black pepper</p>
        </div>
        <div class="text-xl serif">$24</div>
      </div>
      <div class="flex justify-between items-end border-b border-[#2d3725]/10 pb-4">
        <div>
          <h3 class="text-2xl serif mb-2">Ossobuco alla Milanese</h3>
          <p class="text-sm opacity-70">Braised veal shank, saffron risotto, gremolata</p>
        </div>
        <div class="text-xl serif">$38</div>
      </div>
      <div class="flex justify-between items-end border-b border-[#2d3725]/10 pb-4">
        <div>
          <h3 class="text-2xl serif mb-2">Tiramisu Classico</h3>
          <p class="text-sm opacity-70">Espresso-soaked ladyfingers, mascarpone, cocoa</p>
        </div>
        <div class="text-xl serif">$14</div>
      </div>
    </div>
    <div class="mt-12 text-center">
      <a href="#" class="text-[#a62b2b] uppercase tracking-widest text-sm border-b border-[#a62b2b] pb-1 hover:text-[#2d3725] hover:border-[#2d3725] transition-all">View Full Menu</a>
    </div>
  </section>
</body>
</html>`,
  },
  {
    title: "AI Writing Assistant",
    industryTag: "SaaS",
    slug: "ai-writing-saas",
    prompt:
      "A modern SaaS landing page for an AI writing tool. Clean, minimal, lots of whitespace, rounded corners. Use a soft purple and blue gradient aesthetic. Include a prominent 'Try it out' text area in the hero.",
    generatedCode: `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .mesh-bg {
      background-color: #ffffff;
      background-image: radial-gradient(at 0% 0%, hsla(253,16%,7%,0.05) 0, transparent 50%), 
                        radial-gradient(at 50% 0%, hsla(225,39%,30%,0.05) 0, transparent 50%), 
                        radial-gradient(at 100% 0%, hsla(339,49%,30%,0.05) 0, transparent 50%);
    }
  </style>
</head>
<body class="mesh-bg text-slate-900 antialiased selection:bg-indigo-100">
  <nav class="max-w-5xl mx-auto px-6 py-6 flex justify-between items-center">
    <div class="font-bold text-xl tracking-tight flex items-center gap-2">
      <div class="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-500"></div>
      Lexi
    </div>
    <div class="hidden sm:flex gap-6 text-sm font-medium text-slate-600">
      <a href="#" class="hover:text-slate-900">Product</a>
      <a href="#" class="hover:text-slate-900">Pricing</a>
      <a href="#" class="hover:text-slate-900">Blog</a>
    </div>
    <a href="#" class="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">Sign In</a>
  </nav>

  <main class="max-w-4xl mx-auto px-6 py-20 text-center">
    <h1 class="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight">
      Write better.<br>
      <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Think faster.</span>
    </h1>
    <p class="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
      Lexi is an AI writing partner that helps you articulate your thoughts, beat writer's block, and polish your prose in seconds.
    </p>

    <!-- Interactive Editor Mockup -->
    <div class="bg-white rounded-3xl shadow-2xl shadow-indigo-500/10 border border-slate-100 p-2 sm:p-4 text-left max-w-3xl mx-auto relative group">
      <div class="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl opacity-0 group-hover:opacity-20 transition-opacity blur"></div>
      <div class="relative bg-white rounded-2xl p-6 sm:p-8">
        <div class="flex items-center gap-2 mb-4 border-b border-slate-100 pb-4">
          <button class="text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full">✨ Improve</button>
          <button class="text-xs font-semibold px-3 py-1 bg-slate-50 text-slate-600 rounded-full hover:bg-slate-100">Make longer</button>
          <button class="text-xs font-semibold px-3 py-1 bg-slate-50 text-slate-600 rounded-full hover:bg-slate-100">Make professional</button>
        </div>
        <p class="text-slate-400 font-medium text-lg focus:outline-none" contenteditable="true">
          Start typing here, or ask Lexi to draft an email...
        </p>
      </div>
    </div>
  </main>
</body>
</html>`,
  },
  {
    title: "Eco Sneakers",
    industryTag: "Ecommerce",
    slug: "eco-sneakers",
    prompt:
      "An eco-friendly sneaker brand landing page. Earth tones, large product imagery, sustainability stats, and a clean modern sans-serif look. Emphasize the 'zero carbon footprint'.",
    generatedCode: `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Outfit', sans-serif; }
  </style>
</head>
<body class="bg-[#f2efe9] text-[#2c3329] antialiased">
  <nav class="p-6 flex justify-between items-center absolute w-full z-10">
    <div class="text-2xl font-extrabold tracking-tighter">OAK & EARTH</div>
    <div class="flex gap-4">
      <button class="px-6 py-2 rounded-full border border-[#2c3329] font-semibold text-sm hover:bg-[#2c3329] hover:text-[#f2efe9] transition-colors">Shop Men</button>
      <button class="px-6 py-2 rounded-full border border-[#2c3329] font-semibold text-sm hover:bg-[#2c3329] hover:text-[#f2efe9] transition-colors">Shop Women</button>
    </div>
  </nav>

  <header class="min-h-screen flex items-center pt-20 relative overflow-hidden">
    <!-- Abstract nature shapes -->
    <div class="absolute top-0 right-0 w-1/2 h-full bg-[#d6dfcc] rounded-l-full mix-blend-multiply opacity-50 -z-10 blur-3xl"></div>
    
    <div class="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d6dfcc] text-[#2c3329] text-sm font-semibold mb-6">
          <span>🌿</span> 100% Carbon Neutral
        </div>
        <h1 class="text-6xl md:text-8xl font-extrabold leading-[0.9] tracking-tighter mb-6">
          Walk <br>Lighter.
        </h1>
        <p class="text-xl mb-8 max-w-md opacity-80 font-light">
          Sneakers made entirely from recycled ocean plastics and natural rubber. Comfortable on your feet, easy on the planet.
        </p>
        <button class="bg-[#2c3329] text-[#f2efe9] px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-[#2c3329]/20">
          Shop The Collection
        </button>
      </div>
      <div class="relative">
        <div class="absolute inset-0 bg-[#e3d7c5] rounded-full blur-3xl opacity-60 -z-10 transform scale-75"></div>
        <!-- Shoe placeholder -->
        <div class="w-full aspect-square bg-[#d6dfcc] rounded-[3rem] shadow-inner flex items-center justify-center rotate-[-10deg] hover:rotate-0 transition-transform duration-500">
           <span class="text-4xl font-bold opacity-30">Shoe Image</span>
        </div>
      </div>
    </div>
  </header>
  
  <section class="py-24 bg-[#2c3329] text-[#f2efe9]">
    <div class="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
      <div>
        <div class="text-5xl font-extrabold mb-2">12</div>
        <div class="text-sm font-semibold opacity-70 uppercase tracking-widest">Plastic Bottles Recycled</div>
      </div>
      <div>
        <div class="text-5xl font-extrabold mb-2">0</div>
        <div class="text-sm font-semibold opacity-70 uppercase tracking-widest">Carbon Emissions</div>
      </div>
      <div>
        <div class="text-5xl font-extrabold mb-2">100%</div>
        <div class="text-sm font-semibold opacity-70 uppercase tracking-widest">Vegan Materials</div>
      </div>
    </div>
  </section>
</body>
</html>`,
  },
];

export async function GET() {
  try {
    const batch = db.batch();
    const collection = db.collection("officialExamples");

    for (const ex of EXAMPLES) {
      // Check if it exists by slug first to avoid duplicates
      const existing = await collection.where("slug", "==", ex.slug).get();
      if (existing.empty) {
        const ref = collection.doc();
        batch.set(ref, {
          ...ex,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();

    return NextResponse.json({ success: true, message: "Examples seeded successfully." });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: "Failed to seed" }, { status: 500 });
  }
}
