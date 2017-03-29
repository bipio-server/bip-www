<?php
class Bip_Service_BipClient {

    const MODEL_CHANNEL = 'channel';
    const MODEL_ACCOUNT_OPTS = 'account_options';
    
    const RPC_CHANNEL_VERIFY = '/rpc/pod/email/smtp_forward/verify';
    
    protected $_options = array();
    protected $_structs = array();
    protected $_httpClient = null;
    
    public function __construct($apiKey = null, $userName = 'dev') {
        $this->_options = Zend_Registry::get('config')->toArray();
        
        Zend_Rest_Client::getHttpClient()->setAuth($userName, $this->_options['api']['key']);      
        $this->_httpClient = new Zend_Rest_Client($this->_options['api']['host']);
        
        $this->_structs = array(
            self::MODEL_CHANNEL => array(
                "name" => '',
                "action"  => '',
                "config" => '',
                'note' => ''     
            )
        );
    }
    
    protected function _getStruct($modelName) {
        return $this->_structs[$modelName];
    }
    
    // ----------------------------------------------------------- REST GENERIC
    
    public function post($modelName, $modelStruct) {
        try {
            $result = $this->_httpClient->restPost('/rest/' . $modelName, $modelStruct);
        } catch (Exception $e) {
            // @todo log, email etc.
            throw new Exception($e);
        }

        $body = json_decode($result->getBody(), TRUE);
        return $body['id'];   
    }
    
    public function get($modelName, $id) {
        try {
            $result = $this->_httpClient->restGet('/rest/' . $modelName . '/' . $id);
        } catch (Exception $e) {
            // @todo log, email etc.
            throw new Exception($e);
        }

        return json_decode($result->getBody(), TRUE);
    }
    
    public function rpc($path) {
        try {
            $result = $this->_httpClient->restGet($path);
        } catch (Exception $e) {
            // @todo log, email etc.
            throw new Exception($e);
        }

        return json_decode($result->getBody(), TRUE);
    }
    
    // ---------------------------------------------------------------- CHANNEL
    
    /**
     * 
     * @param type $ownerId
     * @param type $label
     * @param type $rcptTo
     * @param type $note
     * @return type
     */
    public function channelEmailCreate($ownerId, $label, $rcptTo, $note = '') {
        $struct = $this->_getStruct(self::MODEL_CHANNEL);
        $struct['name'] = $label;
        $struct['action'] = 'email.smtp_forward';
        $struct['config'] = array( 'rcpt_to' => $rcptTo);
        $struct['note'] = $note;        
        return $this->post(self::MODEL_CHANNEL, $struct);
    }
    
    /**
     * 
     * @param type $channelId
     * @return type
     */
    public function channelEmailRetrieve($channelId) {
        return $this->get(self::MODEL_CHANNEL, $channelId);
    }
    
    /**
     * Given a nonce, calls to the API and sets the channel verification flag.
     * 
     * @param type $nonce
     * @param type $newMode
     * @return type
     */
    public function channelEmailVerify($nonce, $newMode) {
        return $this->rpc(self::RPC_CHANNEL_VERIFY + '?nonce=' . $nonce . '&mode=' . $newMode);
    }
    
    
    // ----------------------------------------------------------- ACCOUNT OPTS
            

    
}