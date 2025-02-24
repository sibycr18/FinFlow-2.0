# FinFlow 2.0 🚀

FinFlow 2.0 is a comprehensive personal finance management platform designed to help individuals and small businesses take control of their financial journey. The application provides a modern, intuitive interface for managing expenses, tracking income, creating budgets, and gaining valuable insights into your financial habits.

## 💰 What is FinFlow?

FinFlow 2.0 serves as your personal financial companion with features designed to make money management effortless:

- **Expense Tracking**: Easily log and categorize your daily expenses
- **Income Management**: Track multiple income sources and payment schedules
- **Budget Planning**: Create and manage monthly or custom-period budgets
- **Financial Goals**: Set and track progress towards your savings and investment goals
- **Smart Analytics**: Get insights into your spending patterns with visual reports and analytics
- **Bill Reminders**: Never miss a payment with automated bill reminders
- **Secure Authentication**: Keep your financial data safe with Google OAuth integration
- **Multi-device Access**: Access your financial data from any device with cloud synchronization
- **Export Capabilities**: Download your financial reports in various formats for tax purposes

Whether you're saving for a dream vacation, managing household expenses, or planning for retirement, FinFlow 2.0 provides the tools you need to make informed financial decisions.

## 🌟 Features

- Modern React-based architecture
- Type-safe development with TypeScript
- Fast development experience with Vite
- Beautiful UI components with Tailwind CSS and Headless UI
- Google OAuth integration for secure authentication
- Supabase backend integration
- Date handling with react-datepicker and date-fns
- Responsive and accessible design

## 🛠️ Tech Stack

- **Frontend Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Headless UI
- **Authentication:** 
  - Google OAuth (@react-oauth/google)
  - Supabase Auth
- **Backend Integration:** Supabase
- **Icons:** Lucide React
- **Date Management:** 
  - react-datepicker
  - date-fns

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/finflow-2.0.git
cd finflow-2.0
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
Create a `.env` file in the root directory and add necessary environment variables.

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:5173`

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint for code quality

## 🏗️ Project Structure

```
finflow-2.0/
├── src/               # Source code
├── public/            # Static assets
├── index.html         # Entry HTML file
├── tsconfig.json      # TypeScript configuration
├── vite.config.ts     # Vite configuration
├── tailwind.config.js # Tailwind CSS configuration
└── package.json       # Project dependencies and scripts
```

## 🔧 Configuration

### TypeScript
The project uses TypeScript for type safety. Configuration can be found in:
- `tsconfig.json` - Base TypeScript configuration
- `tsconfig.app.json` - Application-specific configuration
- `tsconfig.node.json` - Node-specific configuration

### Vite
Vite configuration is in `vite.config.ts`, optimized for React and TypeScript.

### Tailwind CSS
Tailwind configuration is in `tailwind.config.js` with PostCSS integration.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- React team for the amazing framework
- Tailwind CSS team for the utility-first CSS framework
- Vite team for the lightning-fast build tool
- All other open-source contributors

---

Made with ❤️ by Siby C.R.
