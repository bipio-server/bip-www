<?php
class Bip_Model_AccountAuth extends Bip_Model_Abstract {
    protected $_collection = 'account_auths';
    
    public function init(array $args = array()) {            
    }
    
    public function cmpPw($tainted, $stored) {
        return Bip_Utility_Crypt::check($tainted, $stored);
    }   
}