#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const ora = require('ora');
require('dotenv').config();

const program = new Command();

// GitHub API configuration
const GITHUB_BASE_URL = 'https://api.github.com/repos/michaelbuckner/Now-SC-Base-Prompts/contents/Prompts';
const GITHUB_API_URL = 'https://api.github.com';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';

// Directory structure template
const DIRECTORY_STRUCTURE = {
  '00_Inbox': {
    'calls': {
      'internal': {},
      'external': {}
    },
    'emails': {},
    'notes': {}
  },
  '01_Customers': {},
  '10_PromptTemplates': {},
  '20_Demo_Library': {},
  '99_Assets': {
    'Project_Overview': {},
    'Communications': {},
    'POC_Documents': {}
  }
};

// Create directory structure recursively
async function createDirectoryStructure(basePath, structure, customerName = null) {
  for (const [dirName, subDirs] of Object.entries(structure)) {
    let fullPath = path.join(basePath, dirName);
    
    // Handle customer placeholder
    if (dirName === '01_Customers' && customerName) {
      const customerPath = path.join(fullPath, customerName);
      await fs.mkdir(customerPath, { recursive: true });
    } else {
      await fs.mkdir(fullPath, { recursive: true });
    }
    
    // Recursively create subdirectories
    if (Object.keys(subDirs).length > 0) {
      await createDirectoryStructure(fullPath, subDirs);
    }
  }
}

// Fetch prompts from GitHub
async function fetchPrompts() {
  try {
    const response = await axios.get(GITHUB_BASE_URL);
    const files = response.data.filter(item => item.type === 'file' && item.name.endsWith('.md'));
    
    const prompts = [];
    for (const file of files) {
      const contentResponse = await axios.get(file.download_url);
      prompts.push({
        name: file.name,
        content: contentResponse.data
      });
    }
    
    return prompts;
  } catch (error) {
    throw new Error(`Failed to fetch prompts from GitHub: ${error.message}`);
  }
}

// Save prompts to the prompt templates directory
async function savePrompts(projectPath, prompts) {
  const promptsPath = path.join(projectPath, '10_PromptTemplates');
  
  for (const prompt of prompts) {
    const filePath = path.join(promptsPath, prompt.name);
    await fs.writeFile(filePath, prompt.content, 'utf8');
  }
}

// Execute a prompt using OpenRouter API
async function executePrompt(promptContent, userInput = '') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }
  
  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: promptContent
          },
          {
            role: 'user',
            content: userInput || 'Please provide guidance based on the system prompt.'
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/now-sc-cli',
          'X-Title': 'Now-SC CLI Tool'
        }
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    if (error.response) {
      throw new Error(`OpenRouter API error: ${error.response.data.error?.message || error.response.statusText}`);
    }
    throw new Error(`Failed to execute prompt: ${error.message}`);
  }
}

// Create GitHub repository
async function createGitHubRepo(repoName, description) {
  const token = process.env.GITHUB_PAT;
  
  if (!token) {
    throw new Error('GITHUB_PAT environment variable is not set');
  }
  
  try {
    const response = await axios.post(
      `${GITHUB_API_URL}/user/repos`,
      {
        name: repoName,
        description: description,
        private: true,
        auto_init: false
      },
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 422) {
      throw new Error(`Repository "${repoName}" already exists on GitHub`);
    }
    throw new Error(`Failed to create GitHub repository: ${error.message}`);
  }
}

// Get GitHub username
async function getGitHubUsername() {
  const token = process.env.GITHUB_PAT;
  
  if (!token) {
    return null;
  }
  
  try {
    const response = await axios.get(`${GITHUB_API_URL}/user`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    return response.data.login;
  } catch (error) {
    return null;
  }
}

// Initialize git repository without pushing
async function initializeGitRepo(projectPath, repoUrl) {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  const commands = [
    'git init',
    `git remote add origin ${repoUrl}`,
    'git branch -M main'
  ];
  
  for (const cmd of commands) {
    try {
      await execPromise(cmd, { cwd: projectPath });
    } catch (error) {
      throw error;
    }
  }
}

// Initialize command
program
  .name('now-sc')
  .description('CLI tool for bootstrapping presales projects for solution consultants')
  .version('1.0.0');

// Init command - create new project
program
  .command('init')
  .description('Initialize a new presales project')
  .option('-n, --name <name>', 'Project name')
  .option('-c, --customer <customer>', 'Customer name')
  .option('--no-github', 'Skip GitHub repository creation')
  .action(async (options) => {
    try {
      let projectName = options.name;
      let customerName = options.customer;
      
      // Interactive prompts if options not provided
      if (!projectName || !customerName) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectName',
            message: 'What is the project name?',
            default: 'presales-project',
            when: !projectName
          },
          {
            type: 'input',
            name: 'customerName',
            message: 'What is the customer name?',
            when: !customerName,
            validate: (input) => input.trim() !== '' || 'Customer name is required'
          }
        ]);
        
        projectName = projectName || answers.projectName;
        customerName = customerName || answers.customerName;
      }
      
      const projectPath = path.join(process.cwd(), projectName);
      
      // Check if directory already exists
      try {
        await fs.access(projectPath);
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `Directory ${projectName} already exists. Overwrite?`,
            default: false
          }
        ]);
        
        if (!overwrite) {
          console.log(chalk.yellow('Project initialization cancelled.'));
          return;
        }
        
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (error) {
        // Directory doesn't exist, which is what we want
      }
      
      const spinner = ora('Creating project structure...').start();
      
      // Create base directory
      await fs.mkdir(projectPath, { recursive: true });
      
      // Create directory structure
      await createDirectoryStructure(projectPath, DIRECTORY_STRUCTURE, customerName);
      
      spinner.text = 'Fetching base prompts from GitHub...';
      
      // Fetch and save prompts
      const prompts = await fetchPrompts();
      await savePrompts(projectPath, prompts);
      
      // Create a README file
      const readmeContent = `# ${projectName}

## Customer: ${customerName}

This project was bootstrapped with Now-SC CLI tool.

## Directory Structure

- **00_Inbox/** - Raw meeting notes and transcripts
  - calls/internal - Internal call recordings and notes
  - calls/external - External call recordings and notes
  - emails - Email communications
  - notes - General notes

- **01_Customers/${customerName}/** - Customer-specific information

- **10_PromptTemplates/** - Ready-to-use prompt templates

- **20_Demo_Library/** - Demo materials and resources

- **99_Assets/** - Processed and synthesized outputs
  - Project_Overview - High-level project summaries
  - Communications - Prepared communications
  - POC_Documents - Proof of concept documentation

## Using Prompts

To execute a prompt, use:
\`\`\`bash
now-sc prompt
\`\`\`

Make sure you have set the OPENROUTER_API_KEY environment variable.
`;
      
      await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);
      
      // Create .env.example file
      const envExample = `# OpenRouter API Key
# Get your API key from https://openrouter.ai/
OPENROUTER_API_KEY=your_api_key_here
`;
      
      await fs.writeFile(path.join(projectPath, '.env.example'), envExample);
      
      // Create .gitignore file
      const gitignoreContent = `node_modules/
.env
.DS_Store
*.log
`;
      await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);
      
      spinner.succeed(chalk.green(`Project "${projectName}" created successfully!`));
      
      // Create GitHub repository if not skipped
      if (options.github !== false && process.env.GITHUB_PAT) {
        spinner.start('Creating GitHub repository...');
        
        try {
          const username = await getGitHubUsername();
          if (!username) {
            spinner.warn(chalk.yellow('Could not retrieve GitHub username. Skipping repository creation.'));
          } else {
            const repoName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-');
            const repoDescription = `Presales project for ${customerName}`;
            
            const repo = await createGitHubRepo(repoName, repoDescription);
            spinner.text = 'Initializing Git repository...';
            
            await initializeGitRepo(projectPath, repo.clone_url);
            
            spinner.succeed(chalk.green('GitHub repository created!'));
            console.log(chalk.cyan(`Repository URL: ${repo.html_url}`));
            console.log(chalk.gray('Git initialized with remote origin set.'));
            console.log(chalk.gray('To push your code: git add . && git commit -m "Initial commit" && git push -u origin main'));
          }
        } catch (error) {
          spinner.fail(chalk.red(`GitHub repository creation failed: ${error.message}`));
          console.log(chalk.yellow('You can create the repository manually later.'));
        }
      } else if (options.github === false) {
        console.log(chalk.gray('\nSkipped GitHub repository creation.'));
      } else if (!process.env.GITHUB_PAT) {
        console.log(chalk.yellow('\nNote: GITHUB_PAT environment variable not set. Skipping GitHub repository creation.'));
        console.log(chalk.gray('To enable automatic repository creation, set your GitHub Personal Access Token:'));
        console.log(chalk.gray('  export GITHUB_PAT=your_token_here'));
      }
      
      console.log('\n' + chalk.cyan('Project structure created:'));
      console.log(chalk.gray(`  ${projectPath}/`));
      console.log(chalk.gray('  ├── 00_Inbox/'));
      console.log(chalk.gray('  ├── 01_Customers/' + customerName + '/'));
      console.log(chalk.gray('  ├── 10_PromptTemplates/'));
      console.log(chalk.gray('  ├── 20_Demo_Library/'));
      console.log(chalk.gray('  └── 99_Assets/'));
      
      console.log('\n' + chalk.yellow('Next steps:'));
      console.log(chalk.gray('  1. cd ' + projectName));
      console.log(chalk.gray('  2. Set your OPENROUTER_API_KEY environment variable'));
      console.log(chalk.gray('  3. Run "now-sc prompt" to execute prompts'));
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Prompt command - execute prompts
program
  .command('prompt')
  .description('Execute a prompt template')
  .action(async () => {
    try {
      // Check for API key
      if (!process.env.OPENROUTER_API_KEY) {
        console.error(chalk.red('Error: OPENROUTER_API_KEY environment variable is not set'));
        console.log(chalk.yellow('Please set your OpenRouter API key:'));
        console.log(chalk.gray('  export OPENROUTER_API_KEY=your_api_key_here'));
        process.exit(1);
      }
      
      // Find prompt templates directory
      const promptsPath = path.join(process.cwd(), '10_PromptTemplates');
      
      try {
        await fs.access(promptsPath);
      } catch (error) {
        console.error(chalk.red('Error: No prompt templates directory found in current directory'));
        console.log(chalk.yellow('Make sure you are in a project created with "now-sc init"'));
        process.exit(1);
      }
      
      // List available prompts
      const files = await fs.readdir(promptsPath);
      const promptFiles = files.filter(f => f.endsWith('.md'));
      
      if (promptFiles.length === 0) {
        console.error(chalk.red('Error: No prompt templates found'));
        process.exit(1);
      }
      
      // Let user select a prompt
      const { selectedPrompt } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedPrompt',
          message: 'Select a prompt template:',
          choices: promptFiles.map(f => ({
            name: f.replace('.md', '').replace(/_/g, ' '),
            value: f
          }))
        }
      ]);
      
      // Read the prompt content
      const promptContent = await fs.readFile(path.join(promptsPath, selectedPrompt), 'utf8');
      
      // Show prompt preview
      console.log('\n' + chalk.cyan('Prompt Preview:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray(promptContent.substring(0, 200) + '...'));
      console.log(chalk.gray('─'.repeat(50)));
      
      // Get user input
      const { userInput } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'userInput',
          message: 'Enter your input for this prompt (press Enter to open editor):'
        }
      ]);
      
      const spinner = ora('Executing prompt...').start();
      
      try {
        const result = await executePrompt(promptContent, userInput);
        spinner.succeed(chalk.green('Prompt executed successfully!'));
        
        console.log('\n' + chalk.cyan('Response:'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(result);
        console.log(chalk.gray('─'.repeat(50)));
        
        // Ask if user wants to save the output
        const { saveOutput } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'saveOutput',
            message: 'Would you like to save this output?',
            default: true
          }
        ]);
        
        if (saveOutput) {
          const { outputLocation } = await inquirer.prompt([
            {
              type: 'list',
              name: 'outputLocation',
              message: 'Where would you like to save the output?',
              choices: [
                { name: 'Project Overview', value: '99_Assets/Project_Overview' },
                { name: 'Communications', value: '99_Assets/Communications' },
                { name: 'POC Documents', value: '99_Assets/POC_Documents' },
                { name: 'Notes', value: '00_Inbox/notes' },
                { name: 'Other (specify)', value: 'other' }
              ]
            }
          ]);
          
          let savePath = outputLocation;
          if (outputLocation === 'other') {
            const { customPath } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customPath',
                message: 'Enter the path (relative to project root):',
                default: '99_Assets'
              }
            ]);
            savePath = customPath;
          }
          
          const { filename } = await inquirer.prompt([
            {
              type: 'input',
              name: 'filename',
              message: 'Enter filename (without extension):',
              default: `${selectedPrompt.replace('.md', '')}_${new Date().toISOString().split('T')[0]}`,
              validate: (input) => input.trim() !== '' || 'Filename is required'
            }
          ]);
          
          const fullPath = path.join(process.cwd(), savePath, `${filename}.md`);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          
          const outputContent = `# ${filename.replace(/_/g, ' ')}

**Date:** ${new Date().toLocaleString()}
**Prompt Template:** ${selectedPrompt}
**Model:** ${DEFAULT_MODEL}

## User Input

${userInput}

## Response

${result}
`;
          
          await fs.writeFile(fullPath, outputContent);
          console.log(chalk.green(`✓ Output saved to: ${fullPath}`));
        }
        
      } catch (error) {
        spinner.fail(chalk.red('Failed to execute prompt'));
        throw error;
      }
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
