import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateContatoDto } from './create-contato.dto';

// ── Helper ────────────────────────────────────────────────────────────────────

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(CreateContatoDto, plain);
  return validate(instance);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CreateContatoDto', () => {

  // ── Payload válido completo ────────────────────────────────────────────────

  describe('payload válido', () => {
    it('deve passar sem erros com email e telefone preenchidos', async () => {
      const errors = await validateDto({
        nome: 'Maria Souza',
        email: 'maria@email.com',
        telefone: '(27) 99999-9999',
        assunto: 'Informação sobre oficinas',
        mensagem: 'Gostaria de saber mais sobre as oficinas disponíveis.',
      });
      expect(errors).toHaveLength(0);
    });

    it('deve passar apenas com email (sem telefone)', async () => {
      const errors = await validateDto({
        nome: 'João Silva',
        email: 'joao@test.com',
        assunto: 'Matrícula',
        mensagem: 'Como faço para matricular minha filha?',
      });
      expect(errors).toHaveLength(0);
    });

    it('deve passar apenas com telefone (sem email)', async () => {
      const errors = await validateDto({
        nome: 'Carlos Lima',
        telefone: '(11) 98765-4321',
        assunto: 'Agendamento',
        mensagem: 'Gostaria de agendar uma visita para conhecer o instituto.',
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ── CORREÇÃO DO BUG: string vazia ≠ undefined ──────────────────────────────
  // Antes da correção, @IsOptional() não ignorava "".
  // O @Transform agora converte "" → undefined, resolvendo o 400 Bad Request.

  describe('CORREÇÃO NG0400 — string vazia em campos opcionais', () => {
    it('deve aceitar email como string vazia "" (convertida para undefined pelo Transform)', async () => {
      const errors = await validateDto({
        nome: 'Teste Usuário',
        email: '',           // ← bug original: "" causava @IsEmail() falhar → 400
        telefone: '(27) 99999-9999',
        assunto: 'Teste Contato',
        mensagem: 'Mensagem de teste com pelo menos dez caracteres.',
      });

      const emailErrors = errors.filter(e => e.property === 'email');
      expect(emailErrors).toHaveLength(0);
    });

    it('deve aceitar telefone como string vazia "" (convertida para undefined pelo Transform)', async () => {
      const errors = await validateDto({
        nome: 'Teste Usuário',
        email: 'valido@email.com',
        telefone: '',        // ← bug original: "" falhava no @Matches() → 400
        assunto: 'Teste Contato',
        mensagem: 'Mensagem de teste com pelo menos dez caracteres.',
      });

      const telefoneErrors = errors.filter(e => e.property === 'telefone');
      expect(telefoneErrors).toHaveLength(0);
    });

    it('deve aceitar email e telefone ambos como string vazia ""', async () => {
      const errors = await validateDto({
        nome: 'Teste Usuário',
        email: '',
        telefone: '',
        assunto: 'Teste Contato',
        mensagem: 'Mensagem de teste com pelo menos dez caracteres.',
      });

      const camposOpcionaisErrors = errors.filter(
        e => e.property === 'email' || e.property === 'telefone',
      );
      expect(camposOpcionaisErrors).toHaveLength(0);
    });
  });

  // ── Payload inválido ───────────────────────────────────────────────────────

  describe('payload inválido', () => {
    it('deve falhar quando nome está vazio', async () => {
      const errors = await validateDto({
        nome: '',
        email: 'ok@email.com',
        assunto: 'Assunto',
        mensagem: 'Mensagem com mais de dez caracteres.',
      });
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });

    it('deve falhar quando nome tem menos de 2 caracteres', async () => {
      const errors = await validateDto({
        nome: 'A',
        email: 'ok@email.com',
        assunto: 'Assunto',
        mensagem: 'Mensagem com mais de dez caracteres.',
      });
      expect(errors.some(e => e.property === 'nome')).toBe(true);
    });

    it('deve falhar com email inválido preenchido (não vazio)', async () => {
      const errors = await validateDto({
        nome: 'Fulano',
        email: 'nao-e-email',  // ← email preenchido mas inválido
        assunto: 'Assunto',
        mensagem: 'Mensagem com mais de dez caracteres.',
      });
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('deve falhar com telefone com caracteres inválidos (letras)', async () => {
      const errors = await validateDto({
        nome: 'Fulano',
        email: 'ok@email.com',
        telefone: 'abc-def',   // ← letras não são permitidas pelo @Matches
        assunto: 'Assunto',
        mensagem: 'Mensagem com mais de dez caracteres.',
      });
      expect(errors.some(e => e.property === 'telefone')).toBe(true);
    });

    it('deve falhar quando assunto é muito curto', async () => {
      const errors = await validateDto({
        nome: 'Fulano',
        email: 'ok@email.com',
        assunto: 'AB',  // ← minLength(3)
        mensagem: 'Mensagem com mais de dez caracteres.',
      });
      expect(errors.some(e => e.property === 'assunto')).toBe(true);
    });

    it('deve falhar quando mensagem é muito curta', async () => {
      const errors = await validateDto({
        nome: 'Fulano',
        email: 'ok@email.com',
        assunto: 'Assunto válido',
        mensagem: 'Curta.',  // ← minLength(10)
      });
      expect(errors.some(e => e.property === 'mensagem')).toBe(true);
    });

    it('deve remover espaços no início/fim do nome via @Transform', async () => {
      const instance = plainToInstance(CreateContatoDto, {
        nome: '   João Silva   ',
        email: 'joao@email.com',
        assunto: 'Assunto do teste',
        mensagem: 'Mensagem com mais de dez caracteres.',
      });
      expect(instance.nome).toBe('João Silva');
    });
  });
});
