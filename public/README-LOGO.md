# Logo do TransporteJá

## Como adicionar o logo

1. Coloque o arquivo da imagem do logo na pasta `public/`
2. Nomeie o arquivo como `logo.png` (ou `logo.svg`, `logo.jpg`)
3. O componente Logo.tsx já está configurado para carregar `/logo.png`

## Formatos suportados
- PNG (recomendado)
- SVG (melhor qualidade)
- JPG

## Tamanho recomendado
- Mínimo: 64x64px
- Ideal: 128x128px ou maior (será redimensionado automaticamente)

## Se usar outro nome de arquivo

Se você quiser usar outro nome (ex: `transporteja-logo.png`), edite o arquivo:
`components/transporteja/Logo.tsx` e altere a linha:
```tsx
src="/logo.png"
```
para:
```tsx
src="/transporteja-logo.png"
```

