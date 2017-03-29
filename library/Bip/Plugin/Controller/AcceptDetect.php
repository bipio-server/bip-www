<?php
/**
 * Detects an XHTML or JSON request type based on the Accept request header
 * Can optionally detect whether the request is an XHR request type for further
 * routing or rendering decisions (JSONP wrappers for example)
 *
 *
 * How to use (put in application/Bootstrap.php):
 *
 * protected function _initRestParser() {
 *     Zend_Controller_Front::getInstance()->registerPlugin(new Plugin_Controller_AcceptDetect());
 * }
 *
 * @author michael pearson <michael@cloudspark.bip.io>
 */
class Bip_Plugin_Controller_AcceptDetect extends Zend_Controller_Plugin_Abstract {

    private $_formatParamName = NULL;
    private $_detectXHR = FALSE;
    private $_xhrField = NULL;

    /**
     * Populates the detected request type into
     * @param string $formatParamName populate this field name into request parameters
     * @param bool $detectXHR (optional) explicitly detects XHR requets (AJAX)
     * @param string $xhrField (optional) populate this field name into request parameters
     */
    public function __construct($formatParamName = '_acc', $detectXHR = FALSE, $xhrField = '_xhr') {
        $this->_formatParamName = $formatParamName;
        $this->_detectXHR = $detectXHR;
        $this->_xhrField = $xhrField;
    }

    /**
     * Called prior to dispatcher
     * @param Zend_Controller_Request_Abstract $request
     */
    public function preDispatch(Zend_Controller_Request_Abstract $request) {

        if (!$request instanceof Zend_Controller_Request_Http) {
            return;
        }

        if ($this->_detectXHR) {
            $request->setParam(
                    $this->_xhrField,
                    (int) $request->getHeader('X_REQUESTED_WITH') == 'XMLHttpRequest');
        }

        $accept = $request->getParam($this->_formatParamName);

        if (empty($accept)) {

            $acceptH = $request->getHeader('Accept');

            $acceptH = explode(',', $acceptH);

            foreach ($acceptH as $a) {
                $accept = substr($a, strpos($a, '/') + 1, strlen($a));
                if ($accept == 'json' || $accept == 'html' || $accept == 'xml') {
                    break;
                }
            }

            if (empty($accept) || $accept == 'html') {
                $accept = 'xml';
            }

            if (!empty($accept)) {
                $request->setParam($this->_formatParamName, $accept);
            }
        }

        $method = $request->getMethod();

        // Try to parse our content if it looks like a PUT, based on the Accept type
        if ($method == 'PUT' || $method == 'POST') {
            $body = $request->getRawBody();
            $putParams = array();

            switch ($accept) {
                // convert json to array
                case 'json' :
                    $putParams = json_decode($body, TRUE);
                    break;
                // convert xml to array
                    /*
                case 'xml' :
                    $putParams = self::xml2Array($body, 'urldecode|trim');
                     break;
                // convert query string in body to array
                */
                default :
                    parse_str($body, $putParams);
                    break;
            }

            $request->setParams($putParams);
        }
    }

    public static function xml2Array($input, $callback = NULL, $recurse = FALSE) {
        $data = ((!$recurse) && is_string($input)) ? simplexml_load_string($input) : $input;
        if ($data instanceof SimpleXMLElement) {
            if (empty($data)) {
                $data = NULL;
            } else {
                $data = (array) $data;
                foreach ($data as &$item) {
                    $item = self::xml2Array($item, $callback, TRUE);
                }
            }
        }

        // Apply callback to scalar data type and return...
        if ($callback !== NULL && is_scalar($data)) {
            // array reverse/explode are a little expensive for big documents.
            if (self::$_deserialiseCallbacksActive === NULL) {
                self::$_deserialiseCallbacksActive = array_reverse(explode('|', $callback));
            }

            foreach (self::$_deserialiseCallbacksActive as $cbFunc) {
                if (is_callable($cbFunc)) {
                    $data = call_user_func($cbFunc, $data);
                }
            }

            if ($recurse === FALSE) {
                self::$_deserialiseCallbacksActive = NULL;
            }
        }

        return $data;
    }

}
