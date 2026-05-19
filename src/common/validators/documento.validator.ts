import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { validarCnpj, validarCpf } from '../helpers/documento.helper';

function valorVazio(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

export function IsCpf(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (valorVazio(value)) return true;
          return typeof value === 'string' && validarCpf(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} deve ser um CPF valido.`;
        },
      },
    });
  };
}

export function IsCpfOuCnpj(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCpfOuCnpj',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (valorVazio(value)) return true;
          return typeof value === 'string' && (validarCpf(value) || validarCnpj(value));
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} deve ser um CPF ou CNPJ valido.`;
        },
      },
    });
  };
}
