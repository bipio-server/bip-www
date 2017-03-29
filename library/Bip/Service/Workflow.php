<?php
class Bip_Service_Workflow {
	public function __construct() {
    $this->_options = Zend_Registry::get('config')->toArray();
  }

  public function signup($emailAddress, $username = '', $campaignId = '') {
    $uri = "/bip/http/signup_track";

		Zend_Rest_Client::getHttpClient()->setAuth(
			$this->_options['api']['wf']['username'],
    	$this->_options['api']['wf']['key']
  	);

    $client = new Zend_Rest_Client($this->_options['api']['wf']['host']);

    try {
      $response = $client->restGet($uri, Array('title' => $emailAddress, 'username' => $username, 'campaignId' => $campaignId));
    } catch (Exception $e) {
      //
    }
  }

  public function cancel($emailAddress) {
    $uri = "/bip/http/cancel_track";

    Zend_Rest_Client::getHttpClient()->setAuth(
      $this->_options['api']['wf']['username'],
      $this->_options['api']['wf']['key']
    );

    $client = new Zend_Rest_Client($this->_options['api']['wf']['host']);

    try {
      $response = $client->restGet($uri, Array('title' => $emailAddress));
    } catch (Exception $e) {
      //
    }
  }

  public function payment($amount) {
    $uri = "/bip/http/invoice_track";

    Zend_Rest_Client::getHttpClient()->setAuth(
      $this->_options['api']['wf']['username'],
      $this->_options['api']['wf']['key']
    );

    $client = new Zend_Rest_Client($this->_options['api']['wf']['host']);

    try {
      $response = $client->restGet($uri, Array('title' => $amount));
    } catch (Exception $e) {
      //
    }
  }

  // whenever a user changes plans
  public function planStart($email, $plan, $amount, $until) {
    $uri = "/bip/http/plan_start";

    Zend_Rest_Client::getHttpClient()->setAuth(
      $this->_options['api']['wf']['username'],
      $this->_options['api']['wf']['key']
    );

    $client = new Zend_Rest_Client($this->_options['api']['wf']['host']);

    try {
      $response = $client->restGet(
        $uri,
        Array(
          'email' => $email,
          'plan' => $plan,
          'amount' => $amount,
          'until' => $until
        )
      );

    } catch (Exception $e) {
      //
    }
  }
}