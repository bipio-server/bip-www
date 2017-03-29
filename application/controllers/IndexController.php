<?php

class IndexController extends Zend_Controller_Action {

    protected $_session = NULL;

    public function init() {
        $this->_session = Zend_Registry::get('default');
        $this->view->authed = ($this->_session->authed == 1);
        $this->view->authUser = $this->_session->authUser;
        $this->_authDAO = new Bip_DAO_Auth();

        if (getenv('APPLICATION_MODE') === 'public_feed') {
            $this->_forward('public-feed', 'index');
            return;
        }


        $this->view->nonce = $_SESSION['_nonce'] = Bip_Utility::uuidV4();

    }

    public function statusAction() {
        $this->view->page = 'status';
        $this->_authDAO = new Bip_DAO_Auth();
        list(
            $this->view->generalStats,
            $this->view->chordChannels,
            $this->view->chordMatrix) = $this->_authDAO->getAllStats('system', true);
    }

    public function mountedAction() {
        exit;
    }

    public function publicFeedAction() {
        $this->_helper->layout->setLayout('feed');

        // I hate PHP with all of my body.
        $options = Zend_Registry::get('config')->toArray();
        $hostname = $options['env']['hostname'];

        $user = str_replace('.' . $hostname, '', $_SERVER['HTTP_HOST']);

        // check for user, grab their basic info if possible
        $this->_authDAO = new Bip_DAO_Auth();
        $account = $this->_authDAO->getAccountLogin($user);
        $accountOptions = $this->_authDAO->getAccountOptions($account['id']);

        if ($account && $account['id'] && $accountOptions['default_feed_id']) {
            $this->view->userId = $account['id'];
            $this->view->name = $account['name'];
            //$this->view->bgURL ="/static/img/cdn/themes/" . $this->view->userId . "/bg.png";

            $apiHost = $options['api']['host'];
            $apiHost = preg_replace('/(https?:\/\/)/', '$1' . $user . '.', $apiHost);

            $client = new Zend_Rest_Client( $apiHost );
            $rpcBasePath = '/rpc/render/channel/' . $accountOptions['default_feed_id'] . '/html';

            $r = $client->restGet($rpcBasePath, $_GET);

            $this->getResponse()->setRawHeader('HTTP/1.1 ' . $r->getStatus() . $r->getMessage());
            //$this->getResponse()->setRawHeader('Content-Type: ' . $r->getHeader('Content-type'));

            if ($r->getStatus() !== 200) {
                $this->_redirect('http://' . $hostname . '/404');
                exit;
            } else {
                //$this->view->pageTitle = 'Ego XOR Truth';
                $data = json_decode($r->getBody());
                //var_dump($data);exit;
                $this->view->pageTitle = $data->name;
                $this->view->pageDescription = $data->description;
                foreach ($data->entries as $entry) {
                    $this->view->body .= '<div class="item"><label>' . ($entry->title) . '</label><img src="' . $apiHost . $rpcBasePath . '?img=' . $entry->files[0]->name . '"/></div>';
                }
            }
        } else {
            $this->_redirect('http://' . $hostname . '/404');
            exit;
        }
    }

    public function notfoundAction() {

    }

    public function timeoutAction() {
    }

    public function licensingAction() {
    }

    public function maintenanceAction() {

    }

    public function resetsignupAction() {
        $this->_helper->layout()->disableLayout();
        $this->_helper->viewRenderer->setNoRender(true);

        unset($_SESSION['bip_created']);
        unset($_SESSION['signup_bip_endpoint']);
    }

    public function indexAction() {
        $request = $this->getRequest();

        $this->view->page = 'index';

        if (WHITE_LABEL) {
          if ($this->_session->authed) {
            $this->_redirect('/dash');
          } else {
            $this->render('index_wl');
          }
        }

        if(LAYOUT == 'shipiot' || LAYOUT == 'build/shipiot'){
        	$this->render('index_shipiot');
        }

        $this->view->podPartialPath = 'docs/partials/pods.phtml';
    }

    public function authAction() {
        $req = $this->getRequest();
        $username = $req->getParam('username');
        $password = $req->getParam('password');
        $response = array();

        $authUser = $this->_authDAO->authenticate($username, $password);

        if (NULL !== $authUser) {

            $this->_session->authed = 1;
            $this->_session->authUser = $authUser;
            $response = array(
                'username' => $authUser['username'],
                'token' => $authUser['auth']['api_token']
            );
        } else {
            $this->getResponse()->setHttpResponseCode(401);
        }

        $this->_helper->json->sendJson($response);
    }

    public function logoutAction() {
        Zend_Session::destroy();
        $this->_redirect('/');
    }

    public function tosAction() {
        $fc = Zend_Controller_Front::getInstance();;
        $this->_options = Zend_Registry::get('config')->toArray();
        $this->_db = $fc->getParam('bootstrap')->getResource('mongo');
        $request = $this->getRequest();
        if ($request->isGet()) {
            $this->view->authUser = $this->_session->authUser;
        } else if ($request->isPost()) {
          $this->_helper->layout()->disableLayout();
          $this->_helper->viewRenderer->setNoRender(true);
          $collection = $this->_db->selectCollection('account_options');
          $collection->update(array('owner_id' => $this->_session->authUser['id']), array('$set' => array("tos_accept" => true)));
          $this->_session->authUser['settings']['tos_accept'] = true;
        }
    }

    public function privacyAction() {

    }

    public function aboutAction() {

    }

    public function contactAction() {

    }

    public function optinAction() {

    }

    /**
     *
     * If we're returning from an oauth callback, then wrap the callback
     * with the logged in users credentials sot they're not prompted for auth.
     *
     */
    public function oauthcbAction() {
        $this->_helper->layout()->disableLayout();
        $this->_helper->viewRenderer->setNoRender(true);
        $pod = $this->getRequest()->getParam('pod');

        $options = Zend_Registry::get('config')->toArray();
        $apiHost = $options['api']['host'];
        $podPath = '/rpc/oauth/' . $pod . '/cb';

        // proxy the request
        if (1 === $this->_session->authed) {
            $authToken = $this->_session->authUser['auth']['api_token'];
            $username = $this->_session->authUser['username'];

            Zend_Rest_Client::getHttpClient()->setAuth($username, $authToken);

            $client = new Zend_Rest_Client($apiHost);
            $r = $client->restGet($podPath);

            foreach ($r->getHeaders() as $key => $header) {
                echo $key . " " . $header . '<br/>';
                $this->getResponse()->setRawHeader($key . ':' . $header);
            }

            echo $r->getBody();
            exit;
            //echo $r->getBody();


            exit;


            // not logged into the site? Then pass through to the API and the
            // user can figure out auth themselves.
        } else {
            $this->_redirect($apiHost . $podPath);
        }
    }

}