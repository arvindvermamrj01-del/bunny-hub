/* ==========================================================================
   BunnyHub — Core Catalog & Fallback Seed Data
   Cinema4U-style multi-industry catalog: Bollywood, Hollywood, South, Web Series, Shorts
   ========================================================================== */
window.BUNNY_HUB_DATA = [
  {
    id: 1,
    title: "Dune: Part Two",
    type: "Movie",
    industry: "Hollywood",
    genre: "Sci-Fi",
    year: 2024,
    rating: "8.6",
    language: "English, Hindi",
    duration: "2h 46m",
    poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
    description: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    cast: "Timothée Chalamet, Zendaya, Rebecca Ferguson, Javier Bardem",
    director: "Denis Villeneuve",
    trailer: "https://www.youtube.com/watch?v=Way9Dexny3w",
    screenshots: [
      "https://image.tmdb.org/t/p/w780/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
      "https://image.tmdb.org/t/p/w780/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg"
    ],
    qualities: [
      { resolution: "480p", size: "450 MB", format: "MP4", status: "Available" },
      { resolution: "720p", size: "950 MB", format: "MKV", status: "Available" },
      { resolution: "1080p", size: "2.2 GB", format: "MKV", status: "Available" },
      { resolution: "4K UHD", size: "6.8 GB", format: "MKV", status: "Available" }
    ],
    is_featured: true,
    view_count: 14250,
    created_at: "2024-03-01T00:00:00Z"
  },
  {
    id: 2,
    title: "12th Fail",
    type: "Movie",
    industry: "Bollywood",
    genre: "Drama",
    year: 2023,
    rating: "8.9",
    language: "Hindi",
    duration: "2h 27m",
    poster: "https://image.tmdb.org/t/p/w500/k3waqu9w8sW9B2IvdG1k1aD8m.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/12thfail_backdrop.jpg",
    description: "Based on the real-life story of IPS Officer Manoj Kumar Sharma, who fearless restarted his academic journey to clear the world's toughest exam.",
    cast: "Vikrant Massey, Medha Shankr, Anant V Joshi",
    director: "Vidhu Vinod Chopra",
    trailer: "https://www.youtube.com/watch?v=2v_sUXid6-g",
    screenshots: [
      "https://image.tmdb.org/t/p/w780/k3waqu9w8sW9B2IvdG1k1aD8m.jpg"
    ],
    qualities: [
      { resolution: "480p", size: "400 MB", format: "MP4", status: "Available" },
      { resolution: "720p", size: "850 MB", format: "MKV", status: "Available" },
      { resolution: "1080p", size: "1.9 GB", format: "MKV", status: "Available" }
    ],
    is_featured: true,
    view_count: 28400,
    created_at: "2023-11-01T00:00:00Z"
  },
  {
    id: 3,
    title: "Jawan",
    type: "Movie",
    industry: "Bollywood",
    genre: "Action",
    year: 2023,
    rating: "7.1",
    language: "Hindi, Tamil, Telugu",
    duration: "2h 49m",
    poster: "https://image.tmdb.org/t/p/w500/jFt1gS4BGHlK8xt76Y81Alp4dbt.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/jawan_bg.jpg",
    description: "A high-octane action thriller outlining the emotional journey of a man set out to correct the wrongs in society.",
    cast: "Shah Rukh Khan, Nayanthara, Vijay Sethupathi, Deepika Padukone",
    director: "Atlee",
    trailer: "https://www.youtube.com/watch?v=MWOlnZSnXWE",
    qualities: [
      { resolution: "720p", size: "1.1 GB", format: "MKV", status: "Available" },
      { resolution: "1080p", size: "2.8 GB", format: "MKV", status: "Available" },
      { resolution: "4K UHD", size: "7.2 GB", format: "MKV", status: "Available" }
    ],
    is_featured: false,
    view_count: 35100,
    created_at: "2023-09-10T00:00:00Z"
  },
  {
    id: 4,
    title: "The Family Man",
    type: "Web Series",
    industry: "Bollywood",
    genre: "Thriller",
    year: 2021,
    rating: "8.7",
    language: "Hindi, English",
    duration: "2 Seasons",
    poster: "https://image.tmdb.org/t/p/w500/tLnPcEwK7W5xJj5X4D8m1K2w3.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/familyman_bg.jpg",
    description: "A working man from the National Investigation Agency must balance family obligations with defending the nation against terrorists.",
    cast: "Manoj Bajpayee, Samantha Ruth Prabhu, Priyamani, Sharib Hashmi",
    director: "Raj & DK",
    seasons: [
      { season: 1, episodes: 10, title: "Season 1" },
      { season: 2, episodes: 9, title: "Season 2" }
    ],
    qualities: [
      { resolution: "720p Pack", size: "3.2 GB", format: "MKV", status: "Available" },
      { resolution: "1080p Pack", size: "7.5 GB", format: "MKV", status: "Available" }
    ],
    is_featured: true,
    view_count: 42100,
    created_at: "2021-06-04T00:00:00Z"
  },
  {
    id: 5,
    title: "Interstellar",
    type: "Movie",
    industry: "Hollywood",
    genre: "Sci-Fi",
    year: 2014,
    rating: "8.7",
    language: "English, Hindi",
    duration: "2h 49m",
    poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/rAiYTsrwGg4Xz4hLp6P4Rk8x.jpg",
    description: "When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot is tasked to pilot a spacecraft along with a team of researchers.",
    cast: "Matthew McConaughey, Anne Hathaway, Jessica Chastain",
    director: "Christopher Nolan",
    trailer: "https://www.youtube.com/watch?v=zSWdZVtXT7E",
    qualities: [
      { resolution: "720p", size: "1.2 GB", format: "MKV", status: "Available" },
      { resolution: "1080p", size: "2.9 GB", format: "MKV", status: "Available" },
      { resolution: "4K IMAX", size: "9.1 GB", format: "MKV", status: "Available" }
    ],
    is_featured: false,
    view_count: 51200,
    created_at: "2014-11-07T00:00:00Z"
  },
  {
    id: 6,
    title: "RRR",
    type: "Movie",
    industry: "South",
    genre: "Action",
    year: 2022,
    rating: "7.9",
    language: "Telugu, Hindi, Tamil",
    duration: "3h 7m",
    poster: "https://image.tmdb.org/t/p/w500/wE0I6efAW4cDDmZQWtwZMOW44EJ.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/rrr_bg.jpg",
    description: "A fictitious story about two legendary revolutionaries and their journey away from home before they began fighting for their country in the 1920s.",
    cast: "N.T. Rama Rao Jr., Ram Charan, Ajay Devgn, Alia Bhatt",
    director: "S.S. Rajamouli",
    trailer: "https://www.youtube.com/watch?v=NgBoAMm4h54",
    qualities: [
      { resolution: "720p", size: "1.4 GB", format: "MKV", status: "Available" },
      { resolution: "1080p", size: "3.4 GB", format: "MKV", status: "Available" }
    ],
    is_featured: false,
    view_count: 38900,
    created_at: "2022-03-25T00:00:00Z"
  },
  {
    id: 7,
    title: "Wednesday",
    type: "Web Series",
    industry: "Hollywood",
    genre: "Comedy",
    year: 2022,
    rating: "8.1",
    language: "English, Hindi",
    duration: "1 Season",
    poster: "https://image.tmdb.org/t/p/w500/9PFonBhy4cQy7Jz20NpMygczOkv.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/wednesday_bg.jpg",
    description: "Wednesday Addams' misadventures as a student at Nevermore Academy: a very unique boarding school.",
    cast: "Jenna Ortega, Gwendoline Christie, Riki Lindhome",
    director: "Tim Burton",
    seasons: [
      { season: 1, episodes: 8, title: "Season 1" }
    ],
    qualities: [
      { resolution: "720p Pack", size: "2.8 GB", format: "MKV", status: "Available" },
      { resolution: "1080p Pack", size: "6.2 GB", format: "MKV", status: "Available" }
    ],
    is_featured: false,
    view_count: 29800,
    created_at: "2022-11-23T00:00:00Z"
  },
  {
    id: 8,
    title: "Kantara",
    type: "Movie",
    industry: "South",
    genre: "Thriller",
    year: 2022,
    rating: "8.3",
    language: "Kannada, Hindi, Telugu",
    duration: "2h 28m",
    poster: "https://image.tmdb.org/t/p/w500/kantara_poster.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/kantara_bg.jpg",
    description: "When greed paves the way for betrayal, scheming and murder, a young tribal warrior embraces his ancestors' spiritual path to seek justice.",
    cast: "Rishab Shetty, Sapthami Gowda, Kishore",
    director: "Rishab Shetty",
    trailer: "https://www.youtube.com/watch?v=8mrVmf23aBc",
    qualities: [
      { resolution: "720p", size: "980 MB", format: "MKV", status: "Available" },
      { resolution: "1080p", size: "2.4 GB", format: "MKV", status: "Available" }
    ],
    is_featured: false,
    view_count: 31200,
    created_at: "2022-09-30T00:00:00Z"
  }
];
