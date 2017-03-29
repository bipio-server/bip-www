<?php

class Bip_Utility_Crypt {

    const DEFAULT_WORK_FACTOR = 10;
    const BLOCK_AES_256 = 16;

    protected static $_cryptConfig = array(
        'blocksize' => self::BLOCK_AES_256,
        'alg' => 'AES-256-CBC'
    );

    public static function hash($password, $work_factor = 0) {
        if ($work_factor < 4 || $work_factor > 31)
            $work_factor = self::DEFAULT_WORK_FACTOR;
            $salt =
                '$2a$' . str_pad($work_factor, 2, '0', STR_PAD_LEFT) . '$' .
                substr(
                    strtr(base64_encode(openssl_random_pseudo_bytes(16)), '+', '.'), 0, 22
                );

        return crypt($password, $salt);
    }

    public static function is_legacy_hash($hash) {
        return substr($hash, 0, 4) != '$2a$';
    }

    public static function check($password, $stored_hash, $legacy_handler = NULL) {
        if (self::is_legacy_hash($stored_hash)) {
            if ($legacy_handler)
                return call_user_func($legacy_handler, $password, $stored_hash);
            else
                throw new Exception('Unsupported hash format');
        }

        return crypt($password, $stored_hash) == $stored_hash;
    }

    /**
     * Encrypts AES
     *
     * @param string $str
     * @param string $key hexadecimal key (of block size)
     * @param string $iv hexadecimal initialization vector (of block size)
     * @return string bsae64 encoded encryption packet
     */
    public static function aesEncrypt($str, $keyVersion = null, $iv = null) {
        // create our (pkcs7) padded block
        $blocksize = self::$_cryptConfig['blocksize']; // AES-256
        $pad = $blocksize - (strlen($str) % $blocksize);
        $str = $str . str_repeat(chr($pad), $pad);

        if (null == $iv) {
            $iv = substr(md5(openssl_random_pseudo_bytes(self::$_cryptConfig['blocksize'])), 0, $blocksize);
        }

        $options = Zend_Registry::get('config')->toArray();
        $key = end($options['crypt']['key']);

        $keyVersion = key($options['crypt']['key']);

        $cypher = openssl_encrypt($str, self::$_cryptConfig['alg'], $key, false, $iv);

        return base64_encode($keyVersion.$iv.$cypher);
    }

    /**
     * Decrypts AES
     *
     * @param string $cryptedStr bsae64 encoded crypt packet
     * @return string decrypted string
     */
    public static function aesDecrypt($cryptedStr) {
        $cryptedStr = base64_decode($cryptedStr);

        $blocksize = self::$_cryptConfig['blocksize'];

        // extract key version, iv and cyphertext
        $keyVersion = substr($cryptedStr, 0, 1);
        $options = Zend_Registry::get('config')->toArray();
        $key = end($options['crypt']['key']);
        $iv = substr($cryptedStr, 1, $blocksize);
        $cypherLen = strlen($cryptedStr);
        $cypher = substr($cryptedStr, $blocksize + 1, $cypherLen);

        $str = openssl_decrypt($cypher, self::$_cryptConfig['alg'], $key, false, $iv);

        // strip padding
        $len = strlen($str);
        $pad = ord($str[$len - 1]);
/*
echo "crypted " . $cryptedStr . " <br>\n";
echo "ver " . $keyVersion . " <br>\n";
echo "key " . $key . " br>\n";
echo "cypher " . $cypher . " <br>\n";

echo "str " . $str . " br>\n";
*/
        $deciphered = substr($str, 0, strlen($str) - $pad);

        if (strlen($deciphered) <= 16) {
          $deciphered = $str;
        }

        //echo strlen($deciphered);


        return $deciphered;
    }
}