import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Mail, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

type Message = { role: 'user' | 'assistant'; content: string };
type Mode = 'chat' | 'contact';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [sendingContact, setSendingContact] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('chatbot-tooltip-dismissed');
    if (dismissed) return;
    const timer = setTimeout(() => setShowTooltip(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const dismissTooltip = () => {
    setShowTooltip(false);
    sessionStorage.setItem('chatbot-tooltip-dismissed', 'true');
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && mode === 'chat' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, mode]);

  const sendContactMessage = async () => {
    const trimmed = contactMsg.trim();
    if (trimmed.length < 5 || sendingContact) return;
    setSendingContact(true);
    try {
      const { error } = await supabase.functions.invoke('contact-admin', {
        body: { message: trimmed },
      });
      if (error) throw error;
      setContactSent(true);
      setContactMsg('');
      toast.success('Message envoyé à notre équipe !');
      setTimeout(() => {
        setMode('chat');
        setContactSent(false);
      }, 2500);
    } catch (e) {
      console.error(e);
      toast.error("Impossible d'envoyer le message. Réessayez.");
    } finally {
      setSendingContact(false);
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur de connexion');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: e instanceof Error ? e.message : 'Une erreur est survenue. Réessayez.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {!open && (
        <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3">
          {showTooltip && (
            <div className="relative bg-background border rounded-xl shadow-lg px-4 py-3 max-w-[220px] animate-in slide-in-from-right-2 fade-in duration-300">
              <button
                onClick={dismissTooltip}
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-muted flex items-center justify-center transition-colors"
                aria-label="Fermer"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
              <p className="text-xs text-foreground font-medium">Besoin d'aide ? 💡</p>
              <p className="text-xs text-muted-foreground mt-1">
                L'assistant PLANEO est là pour vous guider.
              </p>
            </div>
          )}
          <button
            onClick={() => { setOpen(true); dismissTooltip(); }}
            className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg transition-all flex items-center justify-center"
            aria-label="Ouvrir l'assistant"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-2xl">
            {mode === 'contact' ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground h-8 w-8"
                onClick={() => { setMode('chat'); setContactSent(false); }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Bot className="h-5 w-5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {mode === 'contact' ? 'Contacter un admin' : 'Assistant PLANEO'}
              </p>
              <p className="text-xs opacity-80">
                {mode === 'contact'
                  ? 'Votre message sera envoyé à notre équipe'
                  : 'Comment puis-je vous aider ?'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {mode === 'chat' && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
                    <Bot className="h-10 w-10 opacity-40" />
                    <div>
                      <p className="font-medium text-sm">Bonjour ! 👋</p>
                      <p className="text-xs mt-1">
                        Posez-moi vos questions sur l'utilisation de PLANEO.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-2"
                      onClick={() => setMode('contact')}
                    >
                      <Mail className="h-4 w-4" />
                      Contacter un admin
                    </Button>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      )}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ol]:mt-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-2 items-center">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t p-3 space-y-2">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMode('contact')}
                    className="text-xs text-muted-foreground underline w-full text-center"
                  >
                    Besoin de parler à un humain ? Contacter un admin
                  </button>
                )}
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tapez votre message..."
                    disabled={isLoading}
                    className="flex-1 rounded-full"
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="rounded-full h-10 w-10"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {mode === 'contact' && (
            <div className="flex-1 flex flex-col p-4 gap-3">
              {contactSent ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Message envoyé !</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Notre équipe vous répondra rapidement par email.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">
                    Décrivez votre demande, problème ou suggestion. Notre équipe vous répondra par email.
                  </div>
                  <Textarea
                    value={contactMsg}
                    onChange={(e) => setContactMsg(e.target.value)}
                    placeholder="Votre message..."
                    className="flex-1 resize-none"
                    maxLength={5000}
                    disabled={sendingContact}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {contactMsg.length}/5000
                    </span>
                    <Button
                      onClick={sendContactMessage}
                      disabled={contactMsg.trim().length < 5 || sendingContact}
                      className="gap-2"
                    >
                      {sendingContact ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Envoyer
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
