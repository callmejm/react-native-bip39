var unorm = require('unorm')
var assert = require('assert')
var pbkdf2 = require('react-native-crypto').pbkdf2Sync
var createHash = require('react-native-crypto').createHash
var randomBytes = require('react-native-randombytes').randomBytes

var DEFAULT_WORDLIST =  require('./wordlists/en.json')
var Chinese_Simplified = require('./wordlists/cs.json')
var Chinese_Traditional = require('./wordlists/ct.json')

function mnemonicToSeed(mnemonic, password) {
  var mnemonicBuffer = new Buffer(mnemonic, 'utf8')
  var saltBuffer = new Buffer(salt(password), 'utf8')

  return pbkdf2(mnemonicBuffer, saltBuffer, 2048, 64, 'sha512')
}

function mnemonicToSeedHex(mnemonic, password) {
  return mnemonicToSeed(mnemonic, password).toString('hex')
}

function mnemonicToEntropy(mnemonic, wordlist) {
  wordlist = wordlist || DEFAULT_WORDLIST

  var words = mnemonic.split(' ')
  assert(words.length % 3 === 0, 'Invalid mnemonic')

  var belongToList = words.every(function(word) {
    return wordlist.indexOf(word) > -1
  })

  assert(belongToList, 'Invalid mnemonic')

  // convert word indices to 11 bit binary strings
  var bits = words.map(function(word) {
    var index = wordlist.indexOf(word)
    return lpad(index.toString(2), '0', 11)
  }).join('')

  // split the binary string into ENT/CS
  var dividerIndex = Math.floor(bits.length / 33) * 32
  var entropy = bits.slice(0, dividerIndex)
  var checksum = bits.slice(dividerIndex)

  // calculate the checksum and compare
  var entropyBytes = entropy.match(/(.{1,8})/g).map(function(bin) {
    return parseInt(bin, 2)
  })
  var entropyBuffer = new Buffer(entropyBytes)
  var newChecksum = checksumBits(entropyBuffer)

  assert(newChecksum === checksum, 'Invalid mnemonic checksum')

  return entropyBuffer.toString('hex')
}

function entropyToMnemonic(entropy, wordlist) {
  wordlist = wordlist || DEFAULT_WORDLIST

  var entropyBuffer = new Buffer(entropy, 'hex')
  var entropyBits = bytesToBinary([].slice.call(entropyBuffer))
  var checksum = checksumBits(entropyBuffer)

  var bits = entropyBits + checksum
  var chunks = bits.match(/(.{1,11})/g)

  var words = chunks.map(function(binary) {
    var index = parseInt(binary, 2)

    return wordlist[index]
  })

  return words.join(' ')
}

function generateMnemonic(strength, rng, wordlist) {
  return new Promise((resolve, reject) => {
    strength = strength || 128
    rng = rng || randomBytes

    rng(strength / 8, (error, randomBytesBuffer) => {
      if (error) {
        reject(error)
      } else {
        resolve(entropyToMnemonic(randomBytesBuffer.toString('hex'), wordlist))
      }
    })
  })
}

function validateMnemonic(mnemonic, wordlist) {
  try {
    mnemonicToEntropy(mnemonic, wordlist)
  } catch (e) {
    return false
  }

  return true
}

function checksumBits(entropyBuffer) {
  var hash = createHash('sha256').update(entropyBuffer).digest()

  // Calculated constants from BIP39
  var ENT = entropyBuffer.length * 8
  var CS = ENT / 32

  return bytesToBinary([].slice.call(hash)).slice(0, CS)
}

function salt(password) {
  return 'mnemonic' + (unorm.nfkd(password) || '') // Use unorm until String.prototype.normalize gets better browser support
}

//=========== helper methods from bitcoinjs-lib ========

function bytesToBinary(bytes) {
  return bytes.map(function(x) {
    return lpad(x.toString(2), '0', 8)
  }).join('');
}

function lpad(str, padString, length) {
  while (str.length < length) str = padString + str;
  return str;
}

module.exports = {
  mnemonicToSeed: mnemonicToSeed,
  mnemonicToSeedHex: mnemonicToSeedHex,
  mnemonicToEntropy: mnemonicToEntropy,
  entropyToMnemonic: entropyToMnemonic,
  generateMnemonic: generateMnemonic,
  validateMnemonic: validateMnemonic,
  wordlists: {
    DEFAULT_WORDLIST: DEFAULT_WORDLIST,
    Chinese_Simplified:Chinese_Simplified,
    Chinese_Traditional:Chinese_Traditional
  }
}
