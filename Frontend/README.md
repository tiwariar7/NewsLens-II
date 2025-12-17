# NewsLens Frontend

NewsLens is a modern news aggregation platform designed for clarity and efficiency. This repository contains the **Client Application** built with Next.js, focusing on a responsive, accessible, and personalized reading experience.

**[Live Demo](https://news-lens-project.vercel.app) | [Backend Repository](https://github.com/Aditya-Kayasth/NewsLens-backend)**

## Key Features

* **Modern UI:** Built with Next.js App Router, Tailwind CSS, and Shadcn UI for a clean aesthetic.
* **AI-Powered Insights:** One-click article summarization powered by Generative AI.
* **Personalized Feeds:** Dynamic news streams based on user topic preferences.
* **Interactive Dashboard:** Real-time search, category filtering, and sentiment visualization.
* **Secure Auth:** JWT-based session management handling login and registration flows.

## Tech Stack

![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)
![Shadcn/UI](https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white)

## Local Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yourusername/newslens-frontend.git](https://github.com/yourusername/newslens-frontend.git)
    cd newslens-frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    Create a `.env.local` file:
    ```env
    NEXT_PUBLIC_API_URL=http://localhost:5000
    ```

4.  **Start Development Server:**
    ```bash
    npm run dev
    ```

Access the app at `http://localhost:3000`.

## Future Roadmap

* **Collaborative Filtering:** Recommendation engine improvements based on reading history.
* **Social Sharing:** Integrated sharing to social platforms.
* **Offline Mode:** PWA capabilities for offline reading.

## License

MIT License.
