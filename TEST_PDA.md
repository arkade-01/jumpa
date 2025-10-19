# PDA Seed Mismatch Debug

## Error Analysis
```
Left:  DJeAsmmrsnxWzX3iUHx9rRgpfKckWjSqaqa7bg3eDnpw
Right: 6uEm8MpAqXJVjX1ytYBzRAeVzRaAFAfYBnJa4yGrF6h7
```

The two addresses don't match, meaning our PDA derivation is incorrect.

## IDL Seeds for Group Account
From `idl.json`:
```json
"pda": {
  "seeds": [
    {"kind": "const", "value": [71,82,79,85,80,95,83,69,69,68]},
    {"kind": "arg", "path": "group_name"},
    {"kind": "account", "path": "owner"}
  ]
}
```

Breaking it down:
- Seed 1: `[71,82,79,85,80,95,83,69,69,68]` = "GROUP_SEED"
- Seed 2: `group_name` argument (string)
- Seed 3: `owner` account (pubkey)

## Potential Issues

### Issue 1: Seed Constant
The constant might not be exactly "GROUP_SEED" in bytes. Let me verify:
```javascript
[71,82,79,85,80,95,83,69,69,68].map(x => String.fromCharCode(x)).join('')
// = "GROUP_SEED"
```
✅ This is correct.

### Issue 2: String Encoding
Anchor might encode strings differently. The `group_name` is passed as an argument.

Looking at the instruction args:
```json
"args": [
  {"name": "group_name", "type": "string"},
  {"name": "admin_name", "type": "string"},
  {"name": "entry_capital", "type": "u64"},
  {"name": "vote_threshhold", "type": "u8"}
]
```

In Anchor, when a string is used in seeds, it's encoded as UTF-8 bytes directly (no length prefix for seeds).

### Issue 3: Seed Order
The order must be exactly:
1. GROUP_SEED constant
2. group_name bytes
3. owner pubkey bytes

## Solution

The issue is likely that we're not matching the exact encoding Anchor uses. Let me check the Anchor source...

According to Anchor's PDA derivation:
- Constants are used as-is
- String arguments are encoded as UTF-8 without length prefix
- Account pubkeys are the 32-byte address

Our current code:
```typescript
[GROUP_SEED, Buffer.from(groupName, 'utf8'), owner.toBuffer()]
```

This should be correct, BUT the issue might be:
1. The owner pubkey we're using is wrong
2. The group name has special characters
3. There's a mismatch in the seed constant

## Quick Test
Try creating a group with a simple name like "test" to see if it works.


