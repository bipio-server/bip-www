<?php

class AuthController extends Zend_Controller_Action {

  public function init() {
    $this->_session = Zend_Registry::get('default');
    $this->_authDAO = new Bip_DAO_Auth();
    $this->view->nonce = $_SESSION['_nonce'] = Bip_Utility::uuidV4();
  }

  /**
   * Sends username and API token of logged in user (for use by plugins)
   *
   * @todo hmac sign request, only respond from chrome:// referers
   */
  public function whoAction() {
    $response = array();
    if (isset($this->_session->authUser) &&
            !empty($this->_session->authUser)) {

      $response = array(
          'api_token_web' => $this->_session->authUser['auth']['api_token_web'],
          'auth_token' => $this->_session->authUser['auth']['auth_token'],
          'token_username' => $this->_session->authUser['auth']['token_username'],
          'username' => $this->_session->authUser['username'],
          'pfx' => $this->_session->authUser['username'] .
          ':' .
          $this->_session->authUser['auth']['api_token'] .
          '@'
      );

      if (isset($this->_session->authUser['auth']['ws_host'])) {
        $response['ws_host'] = $this->_session->authUser['auth']['ws_host'];
      }

      echo json_encode($response);
    } else {
      $this->getResponse()->setRawHeader('HTTP/1.1 403 Permission Denied');
      $this->getResponse()->sendResponse();
    }
    exit;
  }

  /**
   *
   * regenerate api token
   *
   */
  public function regenAction() {
    $this->getHelper('Layout')
            ->disableLayout();

    $this->getHelper('ViewRenderer')
            ->setNoRender();

    $this->getResponse()
            ->setHeader('Content-Type', 'application/json');

    $nonce = $this->getRequest()->getParam('_nonce');
    if (isset($this->_session->authUser) && !empty($this->_session->authUser)) {
      $token = $this->_authDAO->updateKey($this->_session->authUser['id']);

      // bind new token to session
      $this->_session->authUser['auth']['api_token'] = $token;
      $this->_session->authUser['auth']['api_token_web'] = base64_encode($this->_session->authUser['username'] . ':' . $token);

      $this->refreshAction($this->_session->authUser['auth']);
    } else {
      $this->getResponse()->setRawHeader('HTTP/1.1 403 Permission Denied');
      $this->getResponse()->sendResponse();
    }
    exit;
  }

  /**
   *
   */
  public function refreshAction($newSettings = array()) {
    if (isset($this->_session->authUser) && !empty($this->_session->authUser)) {
      $accountOptions = $this->_authDAO->getAccountOptions($this->_session->authUser['id']);
      $this->_authDAO->bindSettings($accountOptions, $this->_session->authUser['settings']);
      $this->getHelper('json')->sendJson($newSettings ? $newSettings : $this->_session->authUser['settings']);
    } else {
      $this->getResponse()->setRawHeader('HTTP/1.1 403 Permission Denied');
      $this->getResponse()->sendResponse();
    }
  }

  public function signupAction() {
    if (Bip_DAO_Auth::checkAuthType() == 'auth_api') {
      $this->_redirect('/');
    }

    $request = $this->getRequest();

    if ($request->isPost()) {

      $options = Zend_Registry::get('config')->toArray();
      $this->view->hostname = $options['env']['hostname'];
      $this->view->lcLen = 5;

      $this->_helper->layout()->disableLayout();
      $this->_helper->viewRenderer->setNoRender(true);

      $ok = FALSE;
      $un = $request->getParam('signup_username');
      $pass = $request->getParam('signup_password');
      $email = $request->getParam('signup_email');
      $campaignId = $request->getParam('campaignId');

      if ($this->_authDAO->checkUsername($un)
          && (strlen($un) >= $this->view->lcLen)
          && !$this->_authDAO->getAccountByEmail($email)
          ) {

        // create user
        $account = $this->_authDAO->createUser($un, $email, $un);
        $authPacket = $this->_authDAO->installUser($account, $un, null, $pass);

        if (!empty($authPacket)) {
          $this->getResponse()->setHttpResponseCode(200);
          $wf = new Bip_Service_Workflow();
          $wf->signup($email, $un, $campaignId);
          exit;
        }
      }

      $this->getResponse()->setHttpResponseCode(409);
    } else {
      $this->_redirect('/404');
    }
  }

  private function _sendMail($account, $token) {
    $mail = new Zend_Mail('utf-8');

    $mailFrom = 'support@' . HOST_NAME;
    $mail->setFrom($mailFrom);

    $mail->addTo($account['email_account']);

    // subject is a template option
    $mail->setSubject('' . APP_NAME . ' Password Reset');

    $mail->setBodyHtml('Hello ' . $account['name'] . '<br/><br/>
      We received a request to reset your ' . APP_NAME . ' password.  To continue this process,
      click <a href="' . HOST_NAME . '/reset?e=' . $account['email_account'] . '&_r=' . $token . '">here</a>.
      ');

    /*
    $authConfig = array(
        'auth' => 'login',
        'username' => 'postmaster@bip.io',
        'password' => '0t-jefp6vfu5'
    );
     */

    $authConfig = array(
        'auth' => 'login',
        'username' => 'bipiomailer',
        'password' => 'Q6YsVG9flmdy'
    );


    $broken;
    try {
      //$mail->send(new Zend_Mail_Transport_Smtp('smtp.mailgun.org', $authConfig));
      $mail->send(new Zend_Mail_Transport_Smtp('smtp.sendgrid.net', $authConfig));

      return TRUE;
    } catch (Zend_Mail_Protocol_Exception $e) {
      var_dump($e);
      return FALSE;
    }
  }

  public function pwresetAction() {
    if (Bip_DAO_Auth::checkAuthType() == 'auth_api') {
      $this->_redirect('/dash');
    }

    $this->view->page = 'reset';
    $request = $this->getRequest();
    if ($request->isPost()) {
      $nonce = $request->getParam('_nonce');
      $email = $request->getParam('email');
      $password = $request->getParam('password');
      $token = $request->getParam('token');

      if (true || $nonce == $_SESSION['_nonce']) {
        $account = array_pop($this->_authDAO->getUserByEmail($email));

        if ($account) {

          // reset password attempt
          if ($token && $password) {
            if ($this->_authDAO->confirmToken($account, $token)) {
              $this->_authDAO->updatePassword($account['id'], $password);
              $this->_authDAO->destroyToken($account, $token);
            } else {
              $this->getResponse()->setHttpResponseCode(409);
            }
          } else {
            // create a temporary token
            $accessToken = $this->_authDAO->createToken($account['id']);
            if (!$this->_sendMail($account, $accessToken)) {
              $this->getResponse()->setHttpResponseCode(500);
            } else {
              $this->getResponse()->setHttpResponseCode(200);
            }
          }
        } else {
          $this->getResponse()->setHttpResponseCode(409);
        }
      }
      $this->_helper->layout()->disableLayout();
      $this->_helper->viewRenderer->setNoRender(true);
    } else {
      $this->view->nonce = $_SESSION['_nonce'] = Bip_Utility::uuidV4();

      $e = $request->getParam('e');
      $r = trim($request->getParam('_r'), '?'); // zend is injecting a '?' at the end of this variable for some stupid reason

      if ($e && $r) {
        // check mode.
        $account = array_pop($this->_authDAO->getUserByEmail($e));
        if ($account) {
          if ($this->_authDAO->confirmToken($account, $r)) {
            $this->view->mode = 'confirm';
            $this->view->email_address = $e;
            $this->view->token = $r;
          }
        }
      }
    }
  }

  // regenerates avatars for users which do not have avatars.
  public function regenavAction() {
    if ('admin' === $this->_session->authUser['account_level']) {
      $accounts = $this->_authDAO->search('Account', array() );
      foreach($accounts as $account) {
        $url = $this->_authDAO->generateAv(
          $account['id'],
          $account['email_account']
        );
        echo "Updated " . $account['id'] . " " . $account['email_account'] . " " . $url . "<br/>";

      }
    }
    exit;
  }

  /**
   *
   * @todo hmac sign request
   *
   */
  public function checkusernameAction() {
    $this->_helper->layout()->disableLayout();
    $this->_helper->viewRenderer->setNoRender(true);

    $request = $this->getRequest();
    $username = $request->getParam('un');
    if (!empty($username)) {
      if ($this->_authDAO->checkUsername($username)) {
        $resp = array('status' => 'OK');
        echo json_encode($resp);
        exit;
      }
    }
    $this->getResponse()->setHttpResponseCode(409);
  }
}
