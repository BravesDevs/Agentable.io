export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'xai'
  | 'openrouter'

export interface ProviderModel {
  id:    string   // model identifier sent to the provider
  label: string   // human-readable name
}

export interface ProviderSpec {
  id:          ProviderId
  label:       string
  models:      ProviderModel[]
  envFallback: string         // process.env key checked when no user-supplied key exists
  baseUrl?:    string         // for OpenAI-compatible providers (google/xai/openrouter)
}

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  anthropic: {
    id:          'anthropic',
    label:       'Anthropic',
    envFallback: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-opus-4-7',    label: 'Claude Opus 4.7'    },
      { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6'  },
      { id: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5'   },
    ],
  },
  openai: {
    id:          'openai',
    label:       'OpenAI',
    envFallback: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4o',       label: 'GPT-4o'      },
      { id: 'gpt-4o-mini',  label: 'GPT-4o mini' },
      { id: 'o1',           label: 'o1'          },
      { id: 'o3-mini',      label: 'o3-mini'     },
    ],
  },
  google: {
    id:          'google',
    label:       'Google',
    envFallback: 'GOOGLE_API_KEY',
    baseUrl:     'https://generativelanguage.googleapis.com/v1beta/openai/',
    models: [
      { id: 'gemini-2.5-pro',         label: 'Gemini 2.5 Pro'         },
      { id: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash'       },
      { id: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash'       },
    ],
  },
  xai: {
    id:          'xai',
    label:       'xAI (Grok)',
    envFallback: 'XAI_API_KEY',
    baseUrl:     'https://api.x.ai/v1',
    models: [
      { id: 'grok-4',       label: 'Grok 4'       },
      { id: 'grok-3',       label: 'Grok 3'       },
      { id: 'grok-3-mini',  label: 'Grok 3 mini'  },
    ],
  },
  openrouter: {
    id:          'openrouter',
    label:       'OpenRouter (Llama / Qwen / DeepSeek)',
    envFallback: 'OPENROUTER_API_KEY',
    baseUrl:     'https://openrouter.ai/api/v1',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct',  label: 'Llama 3.3 70B'        },
      { id: 'meta-llama/llama-3.1-405b-instruct', label: 'Llama 3.1 405B'       },
      { id: 'qwen/qwen-2.5-72b-instruct',         label: 'Qwen 2.5 72B'         },
      { id: 'qwen/qwen3-coder',                   label: 'Qwen3 Coder'          },
      { id: 'deepseek/deepseek-r1',               label: 'DeepSeek R1'          },
      { id: 'deepseek/deepseek-chat',             label: 'DeepSeek Chat'        },
      { id: 'mistralai/mistral-large',            label: 'Mistral Large'        },
    ],
  },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === 'string' && (PROVIDER_IDS as string[]).includes(v)
}

/** Public-safe registry payload (no env var names). */
export function publicRegistry() {
  return PROVIDER_IDS.map((id) => ({
    id,
    label:  PROVIDERS[id].label,
    models: PROVIDERS[id].models,
  }))
}
