# Now-SC CLI Tool

A command-line tool for bootstrapping presales projects for solution consultants using Cline/Cursor.

## Installation

### From Source (Recommended)
1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies and link globally:
```bash
npm install
npm link
```

Now you can use `now-sc` command globally.

### Local Development
```bash
npm install
node index.js
```

### Uninstall
To remove the global installation:
```bash
npm unlink -g now-sc
```

## Usage

### Initialize a New Project
```bash
now-sc init
```

Or with options:
```bash
now-sc init --name my-project --customer "Acme Corp"
```

Skip GitHub repository creation:
```bash
now-sc init --no-github
```

### Execute Prompts
Navigate to your project directory and run:
```bash
now-sc prompt
```

## Features

- **Project Scaffolding**: Creates a structured directory layout for presales projects
- **Customer Management**: Dedicated folders for each customer
- **Prompt Templates**: Automatically fetches and includes base prompts from GitHub
- **LLM Integration**: Execute prompts using OpenRouter API with Gemini 2.5
- **Output Management**: Save LLM responses to appropriate project folders
- **GitHub Integration**: Automatically creates private GitHub repositories for each project

## Directory Structure

```
project-name/
├── 00_Inbox/                    # Raw meeting notes and transcripts
│   ├── calls/
│   │   ├── internal/           # Internal call recordings and notes
│   │   └── external/           # External call recordings and notes
│   ├── emails/                 # Email communications
│   └── notes/                  # General notes
├── 01_Customers/
│   └── [Customer Name]/        # Customer-specific information
├── 10_PromptTemplates/         # Ready-to-use prompt templates
├── 20_Demo_Library/            # Demo materials and resources
└── 99_Assets/                  # Processed and synthesized outputs
    ├── Project_Overview/       # High-level project summaries
    ├── Communications/         # Prepared communications
    └── POC_Documents/         # Proof of concept documentation
```

## Configuration

### Environment Variables

#### OpenRouter API Key (Required for prompt execution)
```bash
export OPENROUTER_API_KEY=your_api_key_here
```

Get your API key from [OpenRouter](https://openrouter.ai/).

#### GitHub Personal Access Token (Optional for automatic repo creation)
```bash
export GITHUB_PAT=your_github_token_here
```

To create a GitHub PAT:
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with `repo` scope
3. Copy and set as environment variable

### Using .env File
You can also create a `.env` file in your project directory:
```
OPENROUTER_API_KEY=your_api_key_here
GITHUB_PAT=your_github_token_here
```

## Prompt Templates

The tool automatically fetches prompt templates from the [Now-SC-Base-Prompts](https://github.com/michaelbuckner/Now-SC-Base-Prompts) repository.

## Development

### Requirements
- Node.js 14.x or higher
- npm 6.x or higher

### Dependencies
- commander - CLI framework
- chalk - Terminal styling
- inquirer - Interactive prompts
- axios - HTTP requests
- dotenv - Environment variables
- ora - Loading spinners

## License

MIT
